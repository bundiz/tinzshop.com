import { isNewsMediaKey } from '@/server/adapters/wordpress/sanitize';

/**
 * The public URL of a media key (D-277): the configured base URL (https, no trailing slash, validated by the config
 * module on every read, D-282) + `/` + the key. Built when a page is drawn, never stored.
 */
export function mediaPublicUrl(baseUrl: string, key: string): string {
  if (!isNewsMediaKey(key)) throw new Error('mediaPublicUrl: not a media key');
  return `${baseUrl}/${key}`;
}

/**
 * An article's cover URL for a page (D-277): an uploaded cover's key built from the base URL, else the imported cover's
 * stored URL (D-127). With no base URL configured, a keyed cover is left out (null) rather than drawn broken.
 */
export function resolveFeaturedImageUrl(
  row: { readonly featuredImageUrl: string | null; readonly featuredImageKey: string | null },
  baseUrl: string | null,
): string | null {
  if (row.featuredImageKey === null) return row.featuredImageUrl;
  return baseUrl === null || !isNewsMediaKey(row.featuredImageKey) ? null : mediaPublicUrl(baseUrl, row.featuredImageKey);
}

/** An `<img>` start tag of sanitised HTML (sanitize-html escapes `<` and `>` inside attribute values). */
const IMG_TAG = /<img\b[^>]*>/gi;
const MEDIA_KEY_ATTRIBUTE = /\sdata-media-key="([^"]*)"/;

/**
 * A stored, already-sanitised body as a page draws it (D-277): each `<img data-media-key="K">` gets `src="{base}/{K}"`
 * in place of the key attribute. With no base URL, or a key that does not match (the sanitiser never keeps one), the
 * image is removed rather than drawn broken. Everything else is returned as it came.
 */
export function resolveMediaKeys(html: string, baseUrl: string | null): string {
  return html.replace(IMG_TAG, (tag) => {
    const match = MEDIA_KEY_ATTRIBUTE.exec(tag);
    if (match === null) return tag;
    const key = match[1] ?? '';
    if (baseUrl === null || !isNewsMediaKey(key)) return '';
    return tag.replace(MEDIA_KEY_ATTRIBUTE, ` src="${mediaPublicUrl(baseUrl, key)}"`);
  });
}
