import type { CatalogueItemSnapshot, CatalogueVariantSnapshot } from '@/server/services/catalogue/catalogue-snapshot';

function model(
  externalModelId: bigint,
  modelSku: string,
  priceSatang: bigint,
  stockQuantity: number,
  position: number,
  optionIndexes: readonly number[],
): CatalogueVariantSnapshot {
  return {
    externalModelId,
    modelSku,
    priceSatang,
    originalPriceSatang: priceSatang,
    stockQuantity,
    isActive: true,
    position,
    optionIndexes,
  };
}

/** Item 803947690: Capacity (1TB, 2TB) x Colour (Black, Blue), four models. */
export function twoTierSnapshot(overrides: Partial<CatalogueItemSnapshot> = {}): CatalogueItemSnapshot {
  return {
    externalItemId: 803947690n,
    externalStatus: 'NORMAL',
    externalCategoryId: 100001n,
    isKit: false,
    externalCreatedAt: new Date(1793004278_000),
    externalUpdatedAt: new Date(1793004378_000),
    parentSku: 'SBX-IT-SSD',
    name: 'Sandbox SSD',
    description: 'A solid state drive for the sandbox shop.',
    brandName: 'NoBrand',
    weightGrams: 200,
    images: [
      { url: 'https://cf.shopee.co.th/file/sg-11134201-81z1k-muj2ro5yyn7mb3', externalImageId: 'sg-11134201-81z1k-muj2ro5yyn7mb3' },
      { url: 'https://cf.shopee.co.th/file/sg-11134201-81z1k-second', externalImageId: 'sg-11134201-81z1k-second' },
    ],
    optionTypes: [
      { name: 'Capacity', values: ['1TB', '2TB'] },
      { name: 'Colour', values: ['Black', 'Blue'] },
    ],
    variants: [
      model(12998738n, 'SBX-IT-SSD-1TB-BLK', 269000n, 5, 0, [0, 0]),
      model(12998741n, 'SBX-IT-SSD-1TB-BLU', 299000n, 2, 1, [0, 1]),
      model(12998739n, 'SBX-IT-SSD-2TB-BLK', 399000n, 7, 2, [1, 0]),
      model(12998740n, 'SBX-IT-SSD-2TB-BLU', 429000n, 1, 3, [1, 1]),
    ],
    salesCount: 0,
    ratingStar: 0,
    ratingCount: 0,
    rawPayload: { item_id: 803947690, source: 'fixture' },
    ...overrides,
  };
}

/** Item 803947687: no models, so one variant with a null model id. */
export function noModelSnapshot(overrides: Partial<CatalogueItemSnapshot> = {}): CatalogueItemSnapshot {
  return {
    externalItemId: 803947687n,
    externalStatus: 'NORMAL',
    externalCategoryId: 100002n,
    isKit: false,
    externalCreatedAt: new Date(1793004000_000),
    externalUpdatedAt: new Date(1793004100_000),
    parentSku: 'SBX-SW-MK8',
    name: 'Sandbox Kart Game',
    description: 'A racing game for the sandbox shop.',
    brandName: null,
    weightGrams: 100,
    images: [{ url: 'https://cf.shopee.co.th/file/sg-11134201-81z1k-game', externalImageId: 'sg-11134201-81z1k-game' }],
    optionTypes: [],
    variants: [
      {
        externalModelId: null,
        modelSku: 'SBX-SW-MK8',
        priceSatang: 159000n,
        originalPriceSatang: 159000n,
        stockQuantity: 12,
        isActive: true,
        position: 0,
        optionIndexes: [],
      },
    ],
    salesCount: 5,
    ratingStar: 4.5,
    ratingCount: 2,
    rawPayload: { item_id: 803947687, source: 'fixture' },
    ...overrides,
  };
}
