import { describe, expect, it } from 'vitest';
import { decodeSlugParam, newsArticlePath, newsCategoryPath, newsListPath, parsePageParam } from './news-routes';

describe('parsePageParam', () => {
  it('is page 1 when absent', () => {
    expect(parsePageParam(undefined)).toBe(1);
  });

  it('reads a positive integer', () => {
    expect(parsePageParam('1')).toBe(1);
    expect(parsePageParam('12')).toBe(12);
  });

  it('refuses anything else', () => {
    for (const value of ['', '0', '-1', '1.5', 'abc', '01', '2abc', ' 2', '1e3', '99999999999999999999']) {
      expect(parsePageParam(value)).toBeNull();
    }
    expect(parsePageParam(['1', '2'])).toBeNull();
  });
});

describe('decodeSlugParam', () => {
  it('decodes a percent-encoded Thai slug once', () => {
    expect(decodeSlugParam('%E0%B8%9A%E0%B8%97%E0%B8%84%E0%B8%A7%E0%B8%B2%E0%B8%A1')).toBe('บทความ');
    expect(decodeSlugParam('%e0%b8%9a%e0%b8%97%e0%b8%84%e0%b8%a7%e0%b8%b2%e0%b8%a1')).toBe('บทความ');
  });

  it('leaves a plain or already-decoded slug as it is', () => {
    expect(decodeSlugParam('news')).toBe('news');
    expect(decodeSlugParam('บทความ')).toBe('บทความ');
  });

  it('is null for a malformed escape', () => {
    expect(decodeSlugParam('%E0%B8')).toBeNull();
    expect(decodeSlugParam('%zz')).toBeNull();
  });
});

describe('news paths', () => {
  it('percent-encode a Thai slug once', () => {
    expect(newsListPath('th')).toBe('/th/news');
    expect(newsCategoryPath('th', 'บทความ')).toBe('/th/news/category/%E0%B8%9A%E0%B8%97%E0%B8%84%E0%B8%A7%E0%B8%B2%E0%B8%A1');
    expect(newsArticlePath('en', 'a b')).toBe('/en/news/a%20b');
    expect(decodeSlugParam(newsCategoryPath('th', 'บทความ').split('/').at(-1) ?? '')).toBe('บทความ');
  });
});
