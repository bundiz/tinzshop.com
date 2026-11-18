import { isNewsMediaKey } from '@/server/adapters/wordpress/sanitize';

/**
 * The public URL of a media key (D-277): the configured base URL (https, no trailing slash, validated at start-up by
 * `parseMediaConfig`) + `/` + the key. Built when a page is drawn, never stored.
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
