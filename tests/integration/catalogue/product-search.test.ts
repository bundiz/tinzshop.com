import { beforeEach, describe, expect, it } from 'vitest';

import { upsertCatalogueItem } from '@/server/repositories/catalogue/catalogue-repository';
import { findProductSummaries, searchActiveProducts } from '@/server/repositories/catalogue/product-search-repository';
import { getPrisma } from '@/server/repositories/shared/prisma';
import { resetDatabase } from '../setup/database';
import { noModelSnapshot, twoTierSnapshot } from '../fixtures/snapshots';

const T1 = new Date('2026-10-26T01:00:00.000Z');

beforeEach(async () => {
  await resetDatabase();
  await upsertCatalogueItem(twoTierSnapshot(), T1);
  await upsertCatalogueItem(noModelSnapshot(), T1);
});

async function activateAll(): Promise<void> {
  await getPrisma().product.updateMany({ data: { isActive: true } });
}

describe('searchActiveProducts (the news editor product picker, R3)', () => {
  it('finds active products by name, case-insensitively, with name, sku and first image', async () => {
    await activateAll();
    const hits = await searchActiveProducts('SANDBOX ssd', 10);
    expect(hits).toEqual([
      {
        id: expect.any(String),
        name: 'Sandbox SSD',
        sku: 'SBX-IT-SSD',
        imageUrl: 'https://cf.shopee.co.th/file/sg-11134201-81z1k-muj2ro5yyn7mb3',
      },
    ]);
  });

  it('finds active products by the parent sku or a variant sku, case-insensitively', async () => {
    await activateAll();
    expect((await searchActiveProducts('sbx-sw-mk8', 10)).map((hit) => hit.name)).toEqual(['Sandbox Kart Game']);
    expect((await searchActiveProducts('ssd-2tb-blu', 10)).map((hit) => hit.name)).toEqual(['Sandbox SSD']);
  });

  it('leaves out inactive products', async () => {
    await getPrisma().product.updateMany({ where: { parentSku: 'SBX-IT-SSD' }, data: { isActive: true } });
    expect((await searchActiveProducts('sandbox', 10)).map((hit) => hit.name)).toEqual(['Sandbox SSD']);
  });

  it('lists active products for an empty query, up to the limit, inactive ones left out (D-269)', async () => {
    await getPrisma().product.updateMany({ where: { parentSku: 'SBX-IT-SSD' }, data: { isActive: true } });
    expect((await searchActiveProducts('', 10)).map((hit) => hit.name)).toEqual(['Sandbox SSD']);
    await activateAll();
    expect(await searchActiveProducts('', 10)).toHaveLength(2);
    expect(await searchActiveProducts('', 1)).toHaveLength(1);
  });

  it('returns at most the limit, and treats % and _ as plain characters', async () => {
    await activateAll();
    expect(await searchActiveProducts('sandbox', 1)).toHaveLength(1);
    expect(await searchActiveProducts('%', 10)).toEqual([]);
    expect(await searchActiveProducts('s_x', 10)).toEqual([]);
  });
});

describe('findProductSummaries', () => {
  it('returns the products named, active or not, and ignores unknown ids', async () => {
    const all = await getPrisma().product.findMany({ select: { id: true } });
    const found = await findProductSummaries([...all.map((row) => row.id), '99999999-9999-4999-8999-999999999999']);
    expect(found.map((hit) => hit.name).sort()).toEqual(['Sandbox Kart Game', 'Sandbox SSD']);
  });
});
