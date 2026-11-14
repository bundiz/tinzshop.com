import { describe, expect, it } from 'vitest';

import { safeReturnTo } from './return-to';

describe('safeReturnTo', () => {
  it.each([
    ['//evil.com'],
    ['/\\evil.com'],
    ['https://evil.com'],
    ['/th/product'],
    ['/en'],
    ['/th?x=1'],
    ['/TH/x'],
    ['/En/product'],
    ['/tH'],
    ['/EN?x=1'],
    ['/th#top'],
    ['/a\nb'],
    ['javascript:alert(1)'],
    [''],
    [null],
  ])('sends %j to /', (value) => {
    expect(safeReturnTo(value)).toBe('/');
  });

  it('caps the length at 512 characters', () => {
    const atCap = `/product?q=${'a'.repeat(512 - '/product?q='.length)}`;
    expect(atCap).toHaveLength(512);
    expect(safeReturnTo(atCap)).toBe(atCap);
    expect(safeReturnTo(`${atCap}a`)).toBe('/');
  });

  it.each([['/product/abc/detail'], ['/product?page=2'], ['/thai-news']])('keeps %s', (value) => {
    expect(safeReturnTo(value)).toBe(value);
  });
});
