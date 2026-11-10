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
    ['/a\nb'],
    ['javascript:alert(1)'],
    [''],
    [null],
  ])('sends %j to /', (value) => {
    expect(safeReturnTo(value)).toBe('/');
  });

  it.each([['/product/abc/detail'], ['/product?page=2'], ['/thai-news']])('keeps %s', (value) => {
    expect(safeReturnTo(value)).toBe(value);
  });
});
