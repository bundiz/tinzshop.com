import { describe, expect, it } from 'vitest';

import {
  getProductDetail,
  type StorefrontProductRow,
  type StorefrontProductVariantRow,
} from './product-detail-service';

const PRODUCT_ID = '7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60';

function variant(overrides: Partial<StorefrontProductVariantRow> = {}): StorefrontProductVariantRow {
  return {
    variantId: 'v1',
    position: 0,
    priceSatang: 100000n,
    originalPriceSatang: 100000n,
    stockQuantity: 1,
    isActive: true,
    optionValueIds: [],
    ...overrides,
  };
}

function row(overrides: Partial<StorefrontProductRow> = {}): StorefrontProductRow {
  return {
    productId: PRODUCT_ID,
    isActive: true,
    externalStatus: 'NORMAL',
    names: { th: 'สินค้า', en: 'Product' },
    descriptions: { th: 'รายละเอียด', en: 'Details' },
    brandName: 'NoBrand',
    shippingSizeTier: 'small',
    isPreOrder: false,
    releaseDate: null,
    images: [{ url: 'https://cf.shopee.co.th/file/a', position: 0 }],
    optionTypes: [],
    variants: [variant()],
    ...overrides,
  };
}

function detail(found: StorefrontProductRow | null, locale: 'th' | 'en' = 'th') {
  return getProductDetail({ findStorefrontProduct: async () => found }, PRODUCT_ID, locale);
}

describe('getProductDetail', () => {
  it('returns null for a hidden, unknown or malformed product id', async () => {
    expect(await detail(row({ isActive: false }))).toBeNull();
    expect(await detail(row({ externalStatus: 'UNLIST' }))).toBeNull();
    expect(await detail(row({ variants: [variant({ isActive: false })] }))).toBeNull();
    expect(await detail(null)).toBeNull();
    expect(
      await getProductDetail({ findStorefrontProduct: async () => null }, 'not-a-uuid', 'th'),
    ).toBeNull();
  });

  it('keeps active variants only and picks the cheapest in-stock one as default', async () => {
    const result = await detail(
      row({
        variants: [
          variant({ variantId: 'cheap-inactive', position: 0, priceSatang: 50000n, isActive: false }),
          variant({ variantId: 'cheap-sold-out', position: 1, priceSatang: 80000n, stockQuantity: 0 }),
          variant({ variantId: 'dear', position: 2, priceSatang: 150000n, originalPriceSatang: 180000n }),
          variant({ variantId: 'mid', position: 3, priceSatang: 120000n, originalPriceSatang: 120000n }),
        ],
      }),
    );
    expect(result?.variants.map((v) => v.variantId)).toEqual(['cheap-sold-out', 'dear', 'mid']);
    expect(result?.defaultVariantId).toBe('mid');
    expect(result?.variants[0]?.stockStatus).toBe('out_of_stock');
    expect(result?.variants[1]?.originalPriceSatang).toBe(180000n);
    // An original price equal to the price is no discount.
    expect(result?.variants[2]?.originalPriceSatang).toBeNull();

    // Only an original price above the price is a discount: 0 or a lower one is not shown.
    const notHigher = await detail(
      row({
        variants: [
          variant({ variantId: 'zero', priceSatang: 100000n, originalPriceSatang: 0n }),
          variant({ variantId: 'lower', position: 1, priceSatang: 100000n, originalPriceSatang: 90000n }),
        ],
      }),
    );
    expect(notHigher?.variants.map((v) => v.originalPriceSatang)).toEqual([null, null]);

    const allSoldOut = await detail(
      row({
        variants: [
          variant({ variantId: 'a', priceSatang: 200000n, stockQuantity: 0 }),
          variant({ variantId: 'b', position: 1, priceSatang: 90000n, stockQuantity: 0 }),
        ],
      }),
    );
    expect(allSoldOut?.defaultVariantId).toBe('b');
  });

  it('falls back to the th name and description when en is missing', async () => {
    const result = await detail(
      row({ names: { th: 'เอสเอสดี' }, descriptions: { th: 'บรรทัดหนึ่ง\nบรรทัดสอง' } }),
      'en',
    );
    expect(result?.name).toBe('เอสเอสดี');
    expect(result?.description).toBe('บรรทัดหนึ่ง\nบรรทัดสอง');

    const english = await detail(row(), 'en');
    expect(english?.name).toBe('Product');
    expect(english?.description).toBe('Details');
  });

  it('orders images, option types and values by position', async () => {
    const result = await detail(
      row({
        images: [
          { url: 'https://cf.shopee.co.th/file/second', position: 1 },
          { url: 'https://cf.shopee.co.th/file/first', position: 0 },
        ],
        optionTypes: [
          {
            id: 'colour',
            name: 'Colour',
            position: 1,
            values: [
              { id: 'blue', value: 'Blue', position: 1 },
              { id: 'black', value: 'Black', position: 0 },
            ],
          },
          { id: 'capacity', name: 'Capacity', position: 0, values: [{ id: '1tb', value: '1TB', position: 0 }] },
        ],
      }),
    );
    expect(result?.imageUrls).toEqual(['https://cf.shopee.co.th/file/first', 'https://cf.shopee.co.th/file/second']);
    expect(result?.optionTypes.map((t) => t.id)).toEqual(['capacity', 'colour']);
    expect(result?.optionTypes[1]?.values).toEqual([
      { id: 'black', value: 'Black' },
      { id: 'blue', value: 'Blue' },
    ]);
  });
});
