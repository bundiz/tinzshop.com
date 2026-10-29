import { describe, expect, it, vi } from "vitest";
import { NewsSourceError } from "@/server/services/news/news-import-service";
import type { WordPressClient } from "./client";
import { WordPressApiError } from "./errors";
import { createWordPressNewsSource } from "./news-source";
import type { WpCategory, WpPost } from "./schemas";

function post(id: number, featuredMedia: number, author = 1): WpPost {
  return {
    id,
    date_gmt: "2025-10-23T16:16:00",
    modified_gmt: "2025-10-24T01:00:00",
    slug: `post-${id}`,
    link: `https://old-site.test/post-${id}/`,
    title: { rendered: `Post ${id}` },
    excerpt: { rendered: "<p>Excerpt</p>" },
    content: { rendered: "<p>Body</p>" },
    categories: [5],
    featured_media: featuredMedia,
    author,
  };
}

function fakeClient(overrides: Partial<WordPressClient> = {}): WordPressClient {
  return {
    listCategories: vi.fn(async (): Promise<WpCategory[]> => [
      { id: 5, parent: 0, count: 2, slug: "news", name: "News &amp; more" },
    ]),
    listPostsPage: vi.fn(async () => ({ posts: [post(1, 10), post(2, 10), post(3, 0), post(4, 11, 99)], totalPages: 1 })),
    listAuthors: vi.fn(async () => new Map([[1, "Invented Writer"]])),
    getMedia: vi.fn(async (id: number) => ({ sourceUrl: `https://old-site.test/media/${id}.jpg` })),
    ...overrides,
  };
}

describe("createWordPressNewsSource", () => {
  it("maps categories", async () => {
    const source = createWordPressNewsSource(fakeClient());

    expect(await source.listCategories()).toEqual([
      { sourceId: 5n, parentSourceId: null, slug: "news", translation: { locale: "th", name: "News & more" } },
    ]);
  });

  it("fetches each distinct featured image once and the authors once", async () => {
    const client = fakeClient();
    const source = createWordPressNewsSource(client);

    const first = await source.listArticlesPage(1);
    await source.listArticlesPage(2);

    expect(first.totalPages).toBe(1);
    expect(first.failures).toEqual([]);
    expect(first.articles.map((a) => a.featuredImageUrl)).toEqual([
      "https://old-site.test/media/10.jpg",
      "https://old-site.test/media/10.jpg",
      null,
      "https://old-site.test/media/11.jpg",
    ]);
    expect(first.articles.map((a) => a.bylineName)).toEqual([
      "Invented Writer",
      "Invented Writer",
      "Invented Writer",
      null,
    ]);
    expect(vi.mocked(client.getMedia).mock.calls.map(([id]) => id)).toEqual([10, 11]);
    expect(client.listAuthors).toHaveBeenCalledTimes(1);
    expect(client.listPostsPage).toHaveBeenNthCalledWith(1, 1);
  });

  it("reports a post whose image cannot be read as a failure and keeps the rest", async () => {
    const client = fakeClient({
      getMedia: vi.fn(async (id: number) => {
        if (id === 11) throw new WordPressApiError({ path: "/wp-json/wp/v2/media/11", reason: "http_error", httpStatus: 500 });
        return { sourceUrl: `https://old-site.test/media/${id}.jpg` };
      }),
    });
    const page = await createWordPressNewsSource(client).listArticlesPage(1);

    expect(page.articles.map((a) => a.sourceId)).toEqual([1n, 2n, 3n]);
    expect(page.failures).toEqual([{ sourceId: 4n, reason: "http_error" }]);
  });

  it("turns a failed list into a NewsSourceError with the reason as its code", async () => {
    const client = fakeClient({
      listCategories: vi.fn(async () => {
        throw new WordPressApiError({ path: "/wp-json/wp/v2/categories", reason: "timeout", httpStatus: 0 });
      }),
    });
    const error = await createWordPressNewsSource(client).listCategories().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NewsSourceError);
    expect((error as NewsSourceError).code).toBe("timeout");
  });
});
