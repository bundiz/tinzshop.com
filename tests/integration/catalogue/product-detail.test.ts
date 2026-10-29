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

  it('returns the product categories with their parents and names, for the breadcrumb', async () => {
    await upsertCatalogueItem(twoTierSnapshot(), T1);
    const prisma = getPrisma();
    const product = await prisma.product.findFirstOrThrow();
    const platform = await prisma.category.create({
      data: { slug: 'playstation-5', position: 1, translations: { create: [{ locale: 'th', name: 'PlayStation 5' }] } },
    });
    const type = await prisma.category.create({
      data: {
        slug: 'playstation-5-game',
        position: 1,
        parentId: platform.id,
        translations: { create: [{ locale: 'th', name: 'แผ่นเกม' }, { locale: 'en', name: 'Games' }] },
      },
    });
    // Only the type is linked, as an admin might leave it: the platform still comes back as its parent.
    await prisma.productCategory.create({ data: { productId: product.id, categoryId: type.id } });
    await prisma.product.update({ where: { id: product.id }, data: { primaryCategoryId: type.id } });

    const row = await findStorefrontProduct(product.id);
    expect(row?.primaryCategoryId).toBe(type.id);
    expect(row?.categories.map((category) => category.slug).sort()).toEqual(['playstation-5', 'playstation-5-game']);
    expect(row?.categories.find((category) => category.id === type.id)).toEqual({
      id: type.id,
      slug: 'playstation-5-game',
      parentId: platform.id,
      position: 1,
      names: { th: 'แผ่นเกม', en: 'Games' },
    });

    const uncategorised = await prisma.product.update({ where: { id: product.id }, data: { primaryCategoryId: null } });
    await prisma.productCategory.deleteMany({ where: { productId: uncategorised.id } });
    const bare = await findStorefrontProduct(product.id);
    expect([bare?.primaryCategoryId, bare?.categories]).toEqual([null, []]);
  });

  it('returns null for a malformed id without throwing', async () => {
    await expect(findStorefrontProduct('not-a-uuid')).resolves.toBeNull();
    await expect(findStorefrontProduct('00000000-0000-4000-8000-000000000000')).resolves.toBeNull();
  });
});
