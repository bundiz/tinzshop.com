import type { NewsArticleSnapshot, NewsCategorySnapshot } from "@/server/services/news/news-snapshot";
import { decodeHtmlEntities, decodeSlug, htmlToPlainText, sanitizeArticleHtml } from "./sanitize";
import type { WpCategory, WpPost } from "./schemas";

/** WordPress's `*_gmt` values carry no zone; they are UTC. */
function gmtToDate(value: string): Date {
  return new Date(`${value}Z`);
}

/** The post's last-modified time as stored in `source_modified_at`, read without mapping the post. */
export function wordPressModifiedAt(post: WpPost): Date {
  return gmtToDate(post.modified_gmt);
}

/**
 * One WordPress post as a neutral article snapshot. Imported posts are published, in Thai only.
 * `authorName` null leaves the byline null; the page shows the fallback text.
 */
export function mapWordPressPost(
  post: WpPost,
  mediaUrl: string | null,
  authorName: string | null,
): NewsArticleSnapshot {
  const body = sanitizeArticleHtml(post.content.rendered);
  const byline = authorName?.trim() ?? "";
  return {
    sourceId: BigInt(post.id),
    slug: decodeSlug(post.slug),
    sourceUrl: post.link,
    sourceModifiedAt: wordPressModifiedAt(post),
    status: "published",
    publishedAt: gmtToDate(post.date_gmt),
    bylineName: byline === "" ? null : byline,
    featuredImageUrl: mediaUrl,
    categorySourceIds: post.categories.map((id) => BigInt(id)),
    translation: {
      locale: "th",
      title: htmlToPlainText(post.title.rendered),
      excerpt: htmlToPlainText(post.excerpt.rendered),
      bodyHtml: body.html,
    },
    removedEmbeds: body.removedEmbeds,
  };
}

/** One WordPress category as a neutral snapshot; parent 0 means top level. */
export function mapWordPressCategory(category: WpCategory): NewsCategorySnapshot {
  return {
    sourceId: BigInt(category.id),
    parentSourceId: category.parent === 0 ? null : BigInt(category.parent),
    slug: decodeSlug(category.slug),
    translation: { locale: "th", name: decodeHtmlEntities(category.name).trim() },
  };
}
