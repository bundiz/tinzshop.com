import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createWordPressClient } from "./client";
import { WordPressApiError } from "./errors";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "__fixtures__", name), "utf8"));
}

interface Recorded {
  url: URL;
  userAgent: string | null;
}

type Responder = (url: URL) => Response;

function build(respond: Responder, baseUrl = "https://old-site.test"): {
  client: ReturnType<typeof createWordPressClient>;
  requests: Recorded[];
} {
  const requests: Recorded[] = [];
  let inFlight = 0;
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    inFlight += 1;
    if (inFlight > 1) throw new Error("requests must run one after another");
    const url = new URL(String(input));
    requests.push({ url, userAgent: new Headers(init?.headers).get("User-Agent") });
    await Promise.resolve();
    inFlight -= 1;
    return respond(url);
  };
  return { client: createWordPressClient({ baseUrl, fetch: impl }), requests };
}

function json(body: unknown, totalPages?: number, status = 200): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (totalPages !== undefined) {
    headers.set("X-WP-TotalPages", String(totalPages));
    headers.set("X-WP-Total", "0");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

const categories = fixture("categories.json") as unknown[];

describe("wordpress client", () => {
  it("client pages until totalPages and sends the User-Agent", async () => {
    const { client, requests } = build((url) => {
      const page = Number(url.searchParams.get("page"));
      const slice = page === 1 ? categories.slice(0, 7) : page === 2 ? categories.slice(7, 12) : categories.slice(12);
      return json(slice, 3);
    });

    const result = await client.listCategories();

    expect(result).toHaveLength(13);
    expect(requests.map((r) => r.url.searchParams.get("page"))).toEqual(["1", "2", "3"]);
    for (const request of requests) {
      expect(request.url.pathname).toBe("/wp-json/wp/v2/categories");
      expect(request.url.searchParams.get("per_page")).toBe("100");
      expect(request.userAgent).toBe("TinzshopNewsImport/1.0");
    }
  });

  it("listPostsPage returns one page of posts and the total page count", async () => {
    const { client, requests } = build(() => json(fixture("posts-page.json"), 270));

    const { posts, totalPages } = await client.listPostsPage(4);

    expect(totalPages).toBe(270);
    expect(posts.map((p) => p.id)).toEqual([5492, 479]);
    expect(requests[0]?.url.pathname).toBe("/wp-json/wp/v2/posts");
    expect(requests[0]?.url.searchParams.get("page")).toBe("4");
    expect(requests[0]?.url.searchParams.get("per_page")).toBe("100");
    expect(requests[0]?.userAgent).toBe("TinzshopNewsImport/1.0");
  });

  it("keeps a base URL's path", async () => {
    const { client, requests } = build(() => json([], 1), "https://old-site.test/blog/");
    await client.listPostsPage(1, 10);
    expect(requests[0]?.url.pathname).toBe("/blog/wp-json/wp/v2/posts");
    expect(requests[0]?.url.searchParams.get("per_page")).toBe("10");
  });

  it("rejects a posts page without the total-pages header", async () => {
    const { client } = build(() => json(fixture("posts-page.json")));
    await expect(client.listPostsPage(1)).rejects.toBeInstanceOf(WordPressApiError);
  });

  it("listAuthors maps every user id to its display name", async () => {
    const { client } = build(() => json(fixture("users.json"), 1));
    const authors = await client.listAuthors();
    expect(authors).toEqual(
      new Map([
        [4, "Author One"],
        [3, "Author Two"],
      ]),
    );
  });

  it("getMedia returns the source URL, null for a missing id, and never calls for id 0", async () => {
    const { client, requests } = build((url) =>
      url.pathname.endsWith("/5493")
        ? json(fixture("media.json"))
        : json({ code: "rest_post_invalid_id", message: "Invalid post ID.", data: { status: 404 } }, undefined, 404),
    );

    expect(await client.getMedia(5493)).toEqual({
      sourceUrl: "https://www.tinzshop.com/wp-content/uploads/2025/10/Assassins-Creed-Shadows-Switch-2-az.jpg",
    });
    expect(await client.getMedia(1)).toBeNull();
    expect(await client.getMedia(0)).toBeNull();
    expect(requests.map((r) => r.url.pathname)).toEqual([
      "/wp-json/wp/v2/media/5493",
      "/wp-json/wp/v2/media/1",
    ]);
  });

  it("an error names the path and reason only, never the URL or the body", async () => {
    const { client } = build(() =>
      new Response("<html>secret-body-text</html>", { status: 500 }),
    );
    const error = await client.listPostsPage(2).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WordPressApiError);
    const message = (error as Error).message;
    expect(message).toContain("/wp-json/wp/v2/posts");
    expect(message).not.toContain("old-site.test");
    expect(message).not.toContain("page=");
    expect(message).not.toContain("secret-body-text");
    expect((error as WordPressApiError).httpStatus).toBe(500);
  });

  it("a network failure becomes a typed error without the original text", async () => {
    const client = createWordPressClient({
      baseUrl: "https://old-site.test",
      fetch: () => Promise.reject(new Error("connect ECONNREFUSED https://old-site.test/wp-json")),
    });
    const error = await client.listCategories().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WordPressApiError);
    expect((error as Error).message).not.toContain("old-site.test");
    expect((error as WordPressApiError).reason).toBe("network_error");
  });

  it("an invalid body is a typed error naming fields, not values", async () => {
    const { client } = build(() => json([{ id: "not-a-number", slug: "x" }], 1));
    const error = await client.listPostsPage(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WordPressApiError);
    expect((error as WordPressApiError).reason).toBe("invalid_response");
    expect((error as Error).message).not.toContain("not-a-number");
  });
});
