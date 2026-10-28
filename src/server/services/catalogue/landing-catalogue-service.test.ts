import { describe, expect, it } from 'vitest';

import {
  buildLandingCatalogue,
  pickProductName,
  toLandingProductCard,
  type StorefrontCandidate,
  type StorefrontVariant,
} from './landing-catalogue-service';

function variant(overrides: Partial<StorefrontVariant> = {}): StorefrontVariant {
  return { priceSatang: 100000n, originalPriceSatang: 100000n, stockQuantity: 1, isActive: true, ...overrides };
}

function candidate(overrides: Partial<StorefrontCandidate> = {}): StorefrontCandidate {
  return {
    productId: 'p1',
    isActive: true,
    externalStatus: 'NORMAL',
    names: { th: 'สินค้า', en: 'Product' },
    imageUrl: 'https://cf.shopee.co.th/file/x',
    isKit: false,
    salesCount: 0,
    isPreOrder: false,
    releaseDate: null,
    variants: [variant()],
    ...overrides,
  };
}

describe('buildLandingCatalogue', () => {
  it('hides products the visibility rule excludes', () => {
    const catalogue = buildLandingCatalogue(
      [
        candidate({ productId: 'inactive', isActive: false, isKit: true, isPreOrder: true }),
        candidate({ productId: 'unlisted', externalStatus: 'UNLIST', isKit: true, isPreOrder: true }),
        candidate({ productId: 'novariant', variants: [variant({ isActive: false })], isKit: true, isPreOrder: true }),
        candidate({ productId: 'ok' }),
      ],
      'th',
    );
    const ids = [...catalogue.bestSellers, ...catalogue.bundles, ...catalogue.preOrders].map((c) => c.productId);
    expect(ids).toEqual(['ok']);
  });

  it('orders best sellers by sales and caps each section', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      candidate({
        productId: `p${i}`,
        names: { th: `n${i}`, en: `n${i}` },
        salesCount: i === 9 ? null : i,
        isKit: true,
      }),
    );
    const catalogue = buildLandingCatalogue(many, 'th');
    expect(catalogue.bestSellers).toHaveLength(8);
    expect(catalogue.bestSellers[0]?.productId).toBe('p8');
    expect(catalogue.bestSellers.map((c) => c.productId)).not.toContain('p9');
    expect(catalogue.bundles).toHaveLength(4);
  });

  it('puts null sales last and breaks ties by name', () => {
    const catalogue = buildLandingCatalogue(
      [
        candidate({ productId: 'n', names: { th: 'a', en: 'a' }, salesCount: null }),
        candidate({ productId: 'b', names: { th: 'b', en: 'b' }, salesCount: 3 }),
        candidate({ productId: 'a', names: { th: 'a', en: 'a' }, salesCount: 3 }),
      ],
      'th',
    );
    expect(catalogue.bestSellers.map((c) => c.productId)).toEqual(['a', 'b', 'n']);
  });

  it('puts kits in bundles and pre-orders in preOrders by release date', () => {
    const catalogue = buildLandingCatalogue(
      [
        candidate({ productId: 'kit', isKit: true }),
        candidate({ productId: 'late', isPreOrder: true, releaseDate: new Date('2026-12-01') }),
        candidate({ productId: 'none', isPreOrder: true, releaseDate: null }),
        candidate({ productId: 'early', isPreOrder: true, releaseDate: new Date('2026-11-01') }),
        candidate({ productId: 'plain' }),
      ],
      'th',
    );
    expect(catalogue.bundles.map((c) => c.productId)).toEqual(['kit']);
    expect(catalogue.preOrders.map((c) => c.productId)).toEqual(['early', 'late', 'none']);
  });
});

describe('toLandingProductCard', () => {
  it('derives the card price from the cheapest active variant', () => {
    const range = toLandingProductCard(
      candidate({ variants: [variant({ priceSatang: 459000n, originalPriceSatang: 459000n }), variant({ priceSatang: 299000n, originalPriceSatang: 299000n })] }),
      'th',
    );
    expect(range.priceSatang).toBe(299000n);
    expect(range.isPriceRange).toBe(true);

    const discounted = toLandingProductCard(
      candidate({ variants: [variant({ priceSatang: 289000n, originalPriceSatang: 299000n })] }),
      'th',
    );
    expect(discounted.originalPriceSatang).toBe(299000n);
    expect(discounted.isPriceRange).toBe(false);

    const same = toLandingProductCard(candidate({ variants: [variant({ priceSatang: 5n, originalPriceSatang: 5n })] }), 'th');
    expect(same.originalPriceSatang).toBeNull();

    // Only an original price above the price is a discount: 0 or a lower one is not shown.
    const zero = toLandingProductCard(candidate({ variants: [variant({ priceSatang: 5n, originalPriceSatang: 0n })] }), 'th');
    expect(zero.originalPriceSatang).toBeNull();
    const lower = toLandingProductCard(candidate({ variants: [variant({ priceSatang: 500n, originalPriceSatang: 400n })] }), 'th');
    expect(lower.originalPriceSatang).toBeNull();

    const ignoresInactive = toLandingProductCard(
      candidate({ variants: [variant({ priceSatang: 100n, originalPriceSatang: 100n, isActive: false }), variant({ priceSatang: 900n, originalPriceSatang: 900n })] }),
      'th',
    );
    expect(ignoresInactive.priceSatang).toBe(900n);
    expect(ignoresInactive.isPriceRange).toBe(false);
  });

  it('derives stock status from active variants only', () => {
    const stock = (quantities: Array<[number, boolean]>) =>
      toLandingProductCard(
        candidate({ variants: quantities.map(([stockQuantity, isActive]) => variant({ stockQuantity, isActive })) }),
        'th',
      ).stockStatus;
    expect(stock([[0, true], [0, true]])).toBe('out_of_stock');
    expect(stock([[0, true], [3, true]])).toBe('in_stock');
    expect(stock([[5, false], [0, true], [0, true]])).toBe('out_of_stock');
  });
});

describe('pickProductName', () => {
  it('falls back to the th name when en is missing', () => {
    expect(pickProductName(candidate({ names: { th: 'ไทย' } }), 'en')).toBe('ไทย');
    expect(pickProductName(candidate({ names: { th: 'ไทย', en: 'English' } }), 'en')).toBe('English');
    expect(pickProductName(candidate({ names: { th: 'ไทย', en: 'English' } }), 'th')).toBe('ไทย');
  });
});
