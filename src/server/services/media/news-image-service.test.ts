import { describe, expect, it } from 'vitest';

import { isNewsMediaKey, NEWS_MEDIA_KEY_PATTERN } from '@/server/adapters/wordpress/sanitize';

import { GIF, HTML, ICC_APP2, JFIF_APP0, PDF, PNG, SVG, TEXT, WEBP, exifApp1, includesBytes, jpeg } from './__fixtures__/images';
import { NEWS_IMAGE_MAX_BYTES, detectImageType, newsImageKey, prepareNewsImage } from './news-image-service';

const NOW = new Date('2026-11-18T05:00:00Z');
const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';

function errorCode(result: ReturnType<typeof prepareNewsImage>): string {
  return result.ok ? 'ok' : result.error.code;
}

describe('detectImageType', () => {
  it.each([
    ['jpeg', jpeg(JFIF_APP0)],
    ['png', PNG],
    ['gif', GIF],
    ['webp', WEBP],
  ])('recognises %s by its first bytes', (type, bytes) => {
    expect(detectImageType(bytes)).toBe(type);
  });

  it.each([
    ['an SVG', SVG],
    ['an HTML page', HTML],
    ['a PDF', PDF],
    ['a text file', TEXT],
    ['a PNG signature cut short', PNG.slice(0, 5)],
    ['nothing', new Uint8Array()],
  ])('refuses %s', (_, bytes) => {
    expect(detectImageType(bytes)).toBeNull();
  });
});

describe('prepareNewsImage', () => {
  it.each([
    ['jpeg', jpeg(JFIF_APP0), 'image/jpeg', 'jpg'],
    ['png', PNG, 'image/png', 'png'],
    ['gif', GIF, 'image/gif', 'gif'],
    ['webp', WEBP, 'image/webp', 'webp'],
  ])('prepares a %s with the detected type, the key and the cache header', (_, bytes, contentType, ext) => {
    const result = prepareNewsImage(bytes, NOW, UUID);
    expect(result).toEqual({
      ok: true,
      data: {
        key: `news/2026/11/${UUID}.${ext}`,
        body: bytes,
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  });

  it('never consults a name: a PNG is a PNG whatever it was called, because only bytes are passed', () => {
    const result = prepareNewsImage(PNG, NOW, UUID);
    expect(result.ok && result.data.contentType).toBe('image/png');
    expect(result.ok && result.data.key.endsWith('.png')).toBe(true);
  });

  it('stores PNG, WebP and GIF byte for byte', () => {
    for (const bytes of [PNG, WEBP, GIF]) {
      const result = prepareNewsImage(bytes, NOW, UUID);
      expect(result.ok && result.data.body).toEqual(bytes);
    }
  });

  it('strips a JPEG\'s location data and keeps its orientation and colour profile', () => {
    const result = prepareNewsImage(jpeg(JFIF_APP0, exifApp1({ orientation: 6 }), ICC_APP2), NOW, UUID);
    expect(result.ok).toBe(true);
    const body = result.ok ? result.data.body : new Uint8Array();
    expect(includesBytes(body, [0x25, 0x88])).toBe(false);
    expect(includesBytes(body, [0x12, 0x01, 0x03, 0x00])).toBe(true);
    expect(includesBytes(body, ICC_APP2)).toBe(true);
  });

  it('refuses an empty file', () => {
    expect(errorCode(prepareNewsImage(new Uint8Array(), NOW, UUID))).toBe('media.empty');
  });

  it('refuses a file one byte over the limit, and takes one at the limit', () => {
    const over = new Uint8Array(NEWS_IMAGE_MAX_BYTES + 1);
    over.set(PNG);
    expect(errorCode(prepareNewsImage(over, NOW, UUID))).toBe('media.too_large');
    const at = new Uint8Array(NEWS_IMAGE_MAX_BYTES);
    at.set(PNG);
    expect(errorCode(prepareNewsImage(at, NOW, UUID))).toBe('ok');
  });

  it.each([
    ['an SVG', SVG],
    ['an HTML page', HTML],
    ['a PDF', PDF],
    ['a text file', TEXT],
    ['a PNG signature cut short', PNG.slice(0, 7)],
  ])('refuses %s as an unsupported type', (_, bytes) => {
    expect(errorCode(prepareNewsImage(bytes, NOW, UUID))).toBe('media.unsupported_type');
  });

  it.each([
    ['a PNG signature followed by HTML', Uint8Array.from([...PNG.slice(0, 8), ...HTML])],
    ['a JPEG magic number followed by HTML', Uint8Array.from([0xff, 0xd8, 0xff, ...HTML])],
    ['a JPEG with no scan', Uint8Array.from([0xff, 0xd8, ...JFIF_APP0, 0xff, 0xd9])],
    ['a GIF header cut short', GIF.slice(0, 10)],
    ['a RIFF WEBP header with no image chunk', Uint8Array.from([...WEBP.slice(0, 12), ...HTML])],
  ])('refuses %s as an invalid image', (_, bytes) => {
    expect(errorCode(prepareNewsImage(bytes, NOW, UUID))).toBe('media.invalid_image');
  });

  it('gives each error a back-office message key', () => {
    const result = prepareNewsImage(SVG, NOW, UUID);
    expect(result.ok ? '' : result.error.messageKey).toBe('admin.news.error.imageType');
  });
});

describe('newsImageKey', () => {
  it('uses the UTC year and month of the upload, even at a Bangkok month boundary', () => {
    // 2027-01-01 03:00 in Bangkok is still December 2026 in UTC.
    expect(newsImageKey('jpeg', new Date('2026-12-31T20:00:00Z'), UUID)).toBe(`news/2026/12/${UUID}.jpg`);
    expect(newsImageKey('png', new Date('2027-01-01T00:00:00Z'), UUID)).toBe(`news/2027/01/${UUID}.png`);
  });

  it('refuses a uuid that is not a lower-case v4', () => {
    expect(() => newsImageKey('gif', NOW, UUID.toUpperCase())).toThrow();
    expect(() => newsImageKey('gif', NOW, '../x')).toThrow();
  });
});

describe('isNewsMediaKey', () => {
  it('accepts every key newsImageKey makes', () => {
    for (const type of ['jpeg', 'png', 'webp', 'gif'] as const) {
      expect(isNewsMediaKey(newsImageKey(type, NOW, UUID))).toBe(true);
    }
    expect(NEWS_MEDIA_KEY_PATTERN.test(`news/2026/01/${UUID}.webp`)).toBe(true);
  });

  it.each([
    ['a parent path', `news/../secret.txt`],
    ['a parent path inside', `news/2026/11/../${UUID}.jpg`],
    ['upper case', `news/2026/11/${UUID.toUpperCase()}.jpg`],
    ['upper-case extension', `news/2026/11/${UUID}.JPG`],
    ['a query', `news/2026/11/${UUID}.jpg?x=1`],
    ['a fragment', `news/2026/11/${UUID}.jpg#x`],
    ['another prefix', `private/2026/11/${UUID}.jpg`],
    ['a leading slash', `/news/2026/11/${UUID}.jpg`],
    ['another extension', `news/2026/11/${UUID}.svg`],
    ['jpeg spelled out', `news/2026/11/${UUID}.jpeg`],
    ['month 13', `news/2026/13/${UUID}.jpg`],
    ['month 00', `news/2026/00/${UUID}.jpg`],
    ['a v1 uuid', 'news/2026/11/6fa459ea-ee8a-11ca-8f2b-0800200c9a66.jpg'],
    ['a trailing newline', `news/2026/11/${UUID}.jpg\n`],
    ['a full URL', `https://example.com/news/2026/11/${UUID}.jpg`],
  ])('refuses %s', (_, key) => {
    expect(isNewsMediaKey(key)).toBe(false);
  });
});
