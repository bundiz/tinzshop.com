import { beforeEach, describe, expect, it } from 'vitest';

import { activateSyncedProducts } from '@/server/repositories/catalogue/activation-repository';
import { upsertCatalogueItem } from '@/server/repositories/catalogue/catalogue-repository';
import { getPrisma } from '@/server/repositories/shared/prisma';
import { resetDatabase } from '../setup/database';
import { noModelSnapshot, twoTierSnapshot } from '../fixtures/snapshots';

const T1 = new Date('2026-10-26T01:00:00.000Z');

beforeEach(async () => {
  await resetDatabase();
});

describe('activateSyncedProducts', () => {
  it('activates NORMAL products with an active variant and returns the count', async () => {
    await upsertCatalogueItem(twoTierSnapshot(), T1);
    await upsertCatalogueItem(noModelSnapshot(), T1);

    expect(await activateSyncedProducts()).toBe(2);
    expect(await getPrisma().product.count({ where: { isActive: true } })).toBe(2);
  });

  it('leaves UNLIST and NOT_FOUND products inactive', async () => {
    await upsertCatalogueItem(noModelSnapshot({ externalItemId: 900n, externalStatus: 'UNLIST', parentSku: 'SBX-UNL' }), T1);
    await upsertCatalogueItem(noModelSnapshot({ externalItemId: 901n, externalStatus: 'NOT_FOUND', parentSku: 'SBX-NF' }), T1);

    expect(await activateSyncedProducts()).toBe(0);
    expect(await getPrisma().product.count({ where: { isActive: true } })).toBe(0);
  });

  it('is idempotent: a second call returns 0', async () => {
    await upsertCatalogueItem(twoTierSnapshot(), T1);

    expect(await activateSyncedProducts()).toBe(1);
    expect(await activateSyncedProducts()).toBe(0);
  });
});
