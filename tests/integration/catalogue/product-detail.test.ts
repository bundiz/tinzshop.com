import { beforeEach, describe, expect, it } from 'vitest';

import { upsertCatalogueItem } from '@/server/repositories/catalogue/catalogue-repository';
import { findStorefrontProduct } from '@/server/repositories/catalogue/storefront-repository';
import { getPrisma } from '@/server/repositories/shared/prisma';
import { resetDatabase } from '../setup/database';
import { twoTierSnapshot } from '../fixtures/snapshots';

const T1 = new Date('2026-10-26T01:00:00.000Z');

beforeEach(async () => {
  await resetDatabase();
});

describe('findStorefrontProduct', () => {
  it('finds an active product with its variants and option links', async () => {
    await upsertCatalogueItem(twoTierSnapshot(), T1);
    const prisma = getPrisma();
    const product = await prisma.product.findFirstOrThrow();
    await prisma.product.update({ where: { id: product.id }, data: { isActive: true, shippingSizeTier: 'small' } });

    const row = await findStorefrontProduct(product.id);
    expect(row?.productId).toBe(product.id);
    expect(row?.isActive).toBe(true);
    expect(row?.externalStatus).toBe('NORMAL');
    expect(row?.names).toEqual({ th: 'Sandbox SSD' });
    expect(row?.descriptions).toEqual({ th: 'A solid state drive for the sandbox shop.' });
    expect(row?.brandName).toBe('NoBrand');
    expect(row?.shippingSizeTier).toBe('small');
    expect(row?.images.map((image) => image.position)).toEqual([0, 1]);
    expect(row?.optionTypes.map((type) => type.name)).toEqual(['Capacity', 'Colour']);
    expect(row?.optionTypes[1]?.values.map((value) => value.value)).toEqual(['Black', 'Blue']);

    expect(row?.variants).toHaveLength(4);
    const valueIds = new Set(row?.optionTypes.flatMap((type) => type.values.map((value) => value.id)));
    for (const variant of row?.variants ?? []) {
      expect(variant.optionValueIds).toHaveLength(2);
      for (const id of variant.optionValueIds) expect(valueIds.has(id)).toBe(true);
    }
  });

  it('returns null for a malformed id without throwing', async () => {
    await expect(findStorefrontProduct('not-a-uuid')).resolves.toBeNull();
    await expect(findStorefrontProduct('00000000-0000-4000-8000-000000000000')).resolves.toBeNull();
  });
});
