import { describe, expect, it } from 'vitest';
import { PRODUCT_CARD_TAG, productIdsIn, splitAtProductCards } from './product-card-embed';

const A = '7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60';
const B = '11111111-2222-4333-8444-555555555555';
const card = (id: string) => `<tinz-product data-id="${id}"></tinz-product>`;

describe('product card placeholder', () => {
  it('names the tag', () => {
    expect(PRODUCT_CARD_TAG).toBe('tinz-product');
  });

  it('splits around two cards and keeps the surrounding HTML intact', () => {
    const html = `<p>one</p>${card(A)}<p>two <strong>x</strong></p>${card(B)}<p>three</p>`;
    expect(splitAtProductCards(html)).toEqual([
      { kind: 'html', html: '<p>one</p>' },
      { kind: 'product', productId: A },
      { kind: 'html', html: '<p>two <strong>x</strong></p>' },
      { kind: 'product', productId: B },
      { kind: 'html', html: '<p>three</p>' },
    ]);
  });

  it('returns one html segment for a body without cards, and nothing for an empty one', () => {
    expect(splitAtProductCards('<p>a</p>')).toEqual([{ kind: 'html', html: '<p>a</p>' }]);
    expect(splitAtProductCards('')).toEqual([]);
  });

  it('has no empty html segment between adjacent cards or at the edges', () => {
    expect(splitAtProductCards(`${card(A)}${card(B)}`).map((s) => s.kind)).toEqual(['product', 'product']);
  });

  it('lists each product id once, in order', () => {
    expect(productIdsIn(`${card(A)}<p>x</p>${card(B)}${card(A)}`)).toEqual([A, B]);
    expect(productIdsIn('<p>none</p>')).toEqual([]);
  });
});
