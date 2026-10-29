import { NewsSourceError } from "@/server/services/news/news-import-service";
import type { NewsArticleFailure, NewsArticleSnapshot, NewsSource } from "@/server/services/news/news-snapshot";
import type { WordPressClient } from "./client";
import { WordPressApiError } from "./errors";
import {
  NEWS_CATEGORY_SLUG_RULES,
  mapWordPressCategories,
  mapWordPressPost,
  wordPressModifiedAt,
  type NewsCategorySlugRules,
} from "./map-post";
import { absoluteHttpUrl } from "./sanitize";
import type { WpPost } from "./schemas";

/** A failed list is the source failing as a whole; the reason is a fixed code and the path holds no query. */
async function asSourceError<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof WordPressApiError) throw new NewsSourceError(error.reason, error.path);
    throw error;
  }
}

function postFailureReason(error: unknown): string {
  return error instanceof WordPressApiError ? error.reason : "mapping_failed";
}

/**
 * The old WordPress site as a news source. Authors are read once per source, and each distinct
 * featured image once (a failed read is retried by the next post that names it). A post whose image
 * cannot be read, or that fails to map, is reported as a failure; the rest of the page still maps.
 * A post the import already holds unchanged is only counted. `rules` defaults to the site's
 * `NEWS_CATEGORY_SLUG_RULES`; a test passes its own.
 */
export function createWordPressNewsSource(
  client: WordPressClient,
  rules: NewsCategorySlugRules = NEWS_CATEGORY_SLUG_RULES,
): NewsSource {
  let authors: Map<number, string> | undefined;
  const mediaUrls = new Map<number, string | null>();

  async function mediaUrlOf(id: number): Promise<string | null> {
    if (id === 0) return null;
    if (mediaUrls.has(id)) return mediaUrls.get(id) ?? null;
    const media = await client.getMedia(id);
    // Only an absolute http(s) address is kept: it ends up in an <img src>.
    const url = media && absoluteHttpUrl(media.sourceUrl) ? media.sourceUrl : null;
    mediaUrls.set(id, url);
    return url;
  }

  async function mapPost(post: WpPost, names: Map<number, string>): Promise<NewsArticleSnapshot> {
    return mapWordPressPost(post, await mediaUrlOf(post.featured_media), names.get(post.author) ?? null);
  }

  return {
    listCategories() {
      return asSourceError(async () => mapWordPressCategories(await client.listCategories(), rules));
    },

    async listArticlesPage(page, isUnchanged) {
      const { names, posts, totalPages } = await asSourceError(async () => {
        authors ??= await client.listAuthors();
        const result = await client.listPostsPage(page);
        return { names: authors, ...result };
      });

      const articles: NewsArticleSnapshot[] = [];
      const failures: NewsArticleFailure[] = [];
      let skipped = 0;
      // One post at a time, so image reads stay sequential.
      for (const post of posts) {
        // An unchanged post costs no image read: nothing of it would be written.
        if (isUnchanged(BigInt(post.id), wordPressModifiedAt(post))) {
          skipped += 1;
          continue;
        }
        try {
          articles.push(await mapPost(post, names));
        } catch (error) {
          failures.push({ sourceId: BigInt(post.id), reason: postFailureReason(error) });
        }
      }
      return { articles, failures, skipped, totalPages };
    },
  };
}
