import { isNewsMediaKey } from '@/server/adapters/wordpress/sanitize';
import type { DomainError, Result } from '@/server/services/shared/result';

import { stripJpegMetadata } from './jpeg-metadata';
import type { MediaObject } from './media-storage';

/** The largest news image accepted, 5 MB (D-278). `serverActions.bodySizeLimit` is 6mb to carry it. */
export const NEWS_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** A key is never reused, so a cached copy is never stale (D-278). */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

export type NewsImageType = 'jpeg' | 'png' | 'webp' | 'gif';

const CONTENT_TYPES: Readonly<Record<NewsImageType, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

const EXTENSIONS: Readonly<Record<NewsImageType, string>> = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_IHDR = [0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]; // length 13, "IHDR"
const WEBP_CHUNKS = ['VP8 ', 'VP8L', 'VP8X'];
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function startsWith(bytes: Uint8Array, prefix: readonly number[], offset = 0): boolean {
  return bytes.length >= offset + prefix.length && prefix.every((byte, i) => bytes[offset + i] === byte);
}

/**
 * The image type from the file's first bytes (magic numbers), or null. The file name and the browser's declared type
 * are never consulted: SVG (which can carry script), HEIC, AVIF and everything else are null.
 */
export function detectImageType(bytes: Uint8Array): NewsImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')) return 'gif';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  return null;
}

/** The object key for an upload: `news/{yyyy}/{mm}/{uuid}.{ext}`, year and month in UTC (D-278). */
export function newsImageKey(type: NewsImageType, now: Date, uuid: string): string {
  if (!UUID_V4.test(uuid)) throw new Error('newsImageKey: the uuid must be a lower-case v4 uuid');
  const year = String(now.getUTCFullYear()).padStart(4, '0');
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const key = `news/${year}/${month}/${uuid}.${EXTENSIONS[type]}`;
  if (!isNewsMediaKey(key)) throw new Error('newsImageKey: the key does not match the media key pattern');
  return key;
}

function failure(code: string, message: string, messageKey: string): { ok: false; error: DomainError } {
  return { ok: false, error: { code, message, messageKey } };
}

const invalidImage = (): { ok: false; error: DomainError } =>
  failure('media.invalid_image', 'The file starts like an image but is not a well-formed one.', 'admin.news.error.imageInvalid');

/**
 * The body to store for a detected type: a JPEG without its location data (D-278), the others byte for byte once their
 * header has the shape the type requires (so a signature followed by an HTML page is refused), or null.
 */
function storedBody(type: NewsImageType, bytes: Uint8Array): Uint8Array | null {
  switch (type) {
    case 'jpeg':
      return stripJpegMetadata(bytes);
    case 'png':
      return startsWith(bytes, PNG_IHDR, 8) && bytes.length >= 8 + 25 ? bytes : null;
    case 'gif':
      // Header (6) and logical screen descriptor (7).
      return bytes.length >= 13 ? bytes : null;
    case 'webp':
      return bytes.length >= 20 && WEBP_CHUNKS.includes(ascii(bytes, 12, 4)) ? bytes : null;
  }
}

/**
 * Checks an uploaded news image by its content and makes what is stored (plan 017 Task 3): the key, the body (a JPEG's
 * location data removed), the detected `Content-Type` and the cache header. Errors: `media.empty`, `media.too_large`,
 * `media.unsupported_type`, `media.invalid_image`.
 */
export function prepareNewsImage(bytes: Uint8Array, now: Date, uuid: string): Result<MediaObject> {
  if (bytes.length === 0) return failure('media.empty', 'The file is empty.', 'admin.news.error.imageInvalid');
  if (bytes.length > NEWS_IMAGE_MAX_BYTES) {
    return failure('media.too_large', 'The file is over 5 MB.', 'admin.news.error.imageTooLarge');
  }
  const type = detectImageType(bytes);
  if (type === null) {
    return failure('media.unsupported_type', 'The file is not a JPEG, PNG, WebP or GIF.', 'admin.news.error.imageType');
  }
  const body = storedBody(type, bytes);
  if (body === null) return invalidImage();
  return {
    ok: true,
    data: { key: newsImageKey(type, now, uuid), body, contentType: CONTENT_TYPES[type], cacheControl: CACHE_CONTROL },
  };
}
