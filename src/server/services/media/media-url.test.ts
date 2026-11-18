import { describe, expect, it } from 'vitest';

import { mediaPublicUrl, resolveFeaturedImageUrl, resolveMediaKeys } from './media-url';

const BASE = 'https://media.example.com';
const KEY = 'news/2026/11/0f8fad5b-d9cb-469f-a165-70867728950e.jpg';
const KEY2 = 'news/2026/12/1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed.gif';

describe('mediaPublicUrl', () => {
  it('appends the key to the base URL', () => {
    expect(mediaPublicUrl(BASE, KEY)).toBe(`${BASE}/${KEY}`);
    expect(mediaPublicUrl('https://s3.ap-southeast-7.amazonaws.com/example-bucket', KEY)).toBe(
      `https://s3.ap-southeast-7.amazonaws.com/example-bucket/${KEY}`,
    );
  });

  it('refuses something that is not a media key', () => {
    expect(() => mediaPublicUrl(BASE, '../secret.txt')).toThrow();
  });
});

describe('resolveMediaKeys', () => {
  it('turns one keyed image into an image with a built src and no data-media-key', () => {
    expect(resolveMediaKeys(`<p>a</p><img data-media-key="${KEY}" alt="รูป" /><p>b</p>`, BASE)).toBe(
      `<p>a</p><img src="${BASE}/${KEY}" alt="รูป" /><p>b</p>`,
    );
  });

  it('resolves several, and leaves an imported image alone', () => {
    const html = `<img data-media-key="${KEY}" alt="a" /><img src="https://old.test/x.jpg" alt="x" /><img data-media-key="${KEY2}" />`;
    expect(resolveMediaKeys(html, BASE)).toBe(
      `<img src="${BASE}/${KEY}" alt="a" /><img src="https://old.test/x.jpg" alt="x" /><img src="${BASE}/${KEY2}" />`,
    );
  });

  it('resolves an image inside a figure and a link', () => {
    const html = `<figure><a href="https://ok.test/" rel="noopener"><img data-media-key="${KEY}" alt="a" /></a><figcaption>c</figcaption></figure>`;
    expect(resolveMediaKeys(html, BASE)).toBe(
      `<figure><a href="https://ok.test/" rel="noopener"><img src="${BASE}/${KEY}" alt="a" /></a><figcaption>c</figcaption></figure>`,
    );
  });

  it('removes a keyed image when no base URL is configured, keeping everything else', () => {
    const html = `<p>a</p><img data-media-key="${KEY}" alt="a" /><img src="https://old.test/x.jpg" alt="x" />`;
    expect(resolveMediaKeys(html, null)).toBe('<p>a</p><img src="https://old.test/x.jpg" alt="x" />');
  });

  it('removes an image whose key is not valid, never writing it into a src', () => {
    expect(resolveMediaKeys('<img data-media-key="../x" alt="a" />', BASE)).toBe('');
  });

  it('leaves a body with no keyed image unchanged', () => {
    const html = '<p>text with data-media-key="x" in it</p><img src="https://old.test/x.jpg" />';
    expect(resolveMediaKeys(html, BASE)).toBe(html);
  });
});

describe('resolveFeaturedImageUrl', () => {
  it('prefers the key, falls back to the stored URL, and is null for a key with no base URL', () => {
    expect(resolveFeaturedImageUrl({ featuredImageKey: KEY, featuredImageUrl: null }, BASE)).toBe(`${BASE}/${KEY}`);
    expect(resolveFeaturedImageUrl({ featuredImageKey: null, featuredImageUrl: 'https://old.test/c.jpg' }, BASE)).toBe('https://old.test/c.jpg');
    expect(resolveFeaturedImageUrl({ featuredImageKey: KEY, featuredImageUrl: null }, null)).toBeNull();
    expect(resolveFeaturedImageUrl({ featuredImageKey: null, featuredImageUrl: null }, BASE)).toBeNull();
  });
});
