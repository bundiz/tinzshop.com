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

/**
 * Which old-site categories are not news categories (owner, 2026-10-29, Q-048; D-139). The one place a
 * WordPress category slug is named. `excluded`: the category and all its descendants are never linked
 * to an article, and a post in excluded categories only is not news. `unlisted`: the category is kept
 * and linked, but has no tab and is never shown as a tag.
 */
export const NEWS_CATEGORY_SLUG_RULES = {
  excluded: ["reviews"],
  unlisted: ["uncategorized"],
} as const satisfies { excluded: readonly string[]; unlisted: readonly string[] };

const EXCLUDED_SLUGS: ReadonlySet<string> = new Set(NEWS_CATEGORY_SLUG_RULES.excluded);
const UNLISTED_SLUGS: ReadonlySet<string> = new Set(NEWS_CATEGORY_SLUG_RULES.unlisted);

/**
 * Every WordPress category as a neutral snapshot, in the order given; parent 0 means top level. A
 * category is excluded when it or any ancestor has an excluded slug (a parent cycle is cut); an
 * excluded or unlisted category has `isListed` false.
 */
export function mapWordPressCategories(categories: readonly WpCategory[]): NewsCategorySnapshot[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const slugOf = (category: WpCategory): string => decodeSlug(category.slug);
  const isExcluded = (category: WpCategory): boolean => {
    const seen = new Set<number>();
    for (let at: WpCategory | undefined = category; at !== undefined && !seen.has(at.id); at = byId.get(at.parent)) {
      if (EXCLUDED_SLUGS.has(slugOf(at))) return true;
      seen.add(at.id);
    }
    return false;
  };
  return categories.map((category) => {
    const slug = slugOf(category);
    const excluded = isExcluded(category);
    return {
      sourceId: BigInt(category.id),
      parentSourceId: category.parent === 0 ? null : BigInt(category.parent),
      slug,
      translation: { locale: "th", name: decodeHtmlEntities(category.name).trim() },
      isListed: !excluded && !UNLISTED_SLUGS.has(slug),
      isExcluded: excluded,
    };
  });
}
