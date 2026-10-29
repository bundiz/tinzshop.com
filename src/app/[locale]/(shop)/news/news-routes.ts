/**
 * `?page=n` on the news list pages: page 1 when absent, a positive integer written plainly ("2", not
 * "02", "2.0" or "2abc"), anything else — including a repeated parameter — `null`, which the page
 * answers with a 404 (spec 2026-10-29 §6).
 */
export function parsePageParam(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^[1-9]\d{0,8}$/.test(value)) return null;
  return Number(value);
}

/**
 * A route slug as stored: decoded. Next hands a dynamic segment over percent-encoded, so a Thai slug
 * (`บทความ`) arrives as `%E0%B8%9A…`; it is decoded exactly once here. A slug with no escapes is
 * returned as it is; a malformed escape is `null` (a 404).
 */
export function decodeSlugParam(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** `/{locale}/news`, the list of every live article. */
export function newsListPath(locale: string): string {
  return `/${locale}/news`;
}

/** `/{locale}/news/category/{slug}`, the slug percent-encoded once. */
export function newsCategoryPath(locale: string, slug: string): string {
  return `/${locale}/news/category/${encodeURIComponent(slug)}`;
}

/** `/{locale}/news/{slug}`, one article (plan 012 Task 6), the slug percent-encoded once. */
export function newsArticlePath(locale: string, slug: string): string {
  return `/${locale}/news/${encodeURIComponent(slug)}`;
}
