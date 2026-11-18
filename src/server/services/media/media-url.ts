import { isNewsMediaKey } from '@/server/adapters/wordpress/sanitize';

/**
 * The public URL of a media key (D-277): the configured base URL (https, no trailing slash, validated at start-up by
 * `parseMediaConfig`) + `/` + the key. Built when a page is drawn, never stored.
 */
export function mediaPublicUrl(baseUrl: string, key: string): string {
  if (!isNewsMediaKey(key)) throw new Error('mediaPublicUrl: not a media key');
  return `${baseUrl}/${key}`;
}
