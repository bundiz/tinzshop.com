import { beforeEach, describe, expect, it } from 'vitest';

import { upsertCatalogueItem } from '@/server/repositories/catalogue/catalogue-repository';
import { listStorefrontCandidates } from '@/server/repositories/catalogue/storefront-repository';
import { getPrisma } from '@/server/repositories/shared/prisma';
import { resetDatabase } from '../setup/database';
import { noModelSnapshot, twoTierSnapshot } from '../fixtures/snapshots';

const T1 = new Date('2026-10-26T01:00:00.000Z');

beforeEach(async () => {
  await resetDatabase();
});

describe('listStorefrontCandidates', () => {
  it('returns only active NORMAL products with their variants', async () => {
    await upsertCatalogueItem(twoTierSnapshot(), T1);
    await upsertCatalogueItem(noModelSnapshot(), T1);
    await upsertCatalogueItem(noModelSnapshot({ externalItemId: 900n, externalStatus: 'UNLIST', parentSku: 'SBX-UNL' }), T1);
    await upsertCatalogueItem(noModelSnapshot({ externalItemId: 901n, parentSku: 'SBX-OFF' }), T1);

    const prisma = getPrisma();
    const off = await prisma.product.findFirstOrThrow({ where: { parentSku: 'SBX-OFF' } });
    await prisma.product.updateMany({ where: { parentSku: { not: 'SBX-OFF' } }, data: { isActive: true } });
    expect(off.isActive).toBe(false);

    const candidates = await listStorefrontCandidates();
    expect(candidates).toHaveLength(2);
    const ssd = candidates.find((c) => c.names.th === 'Sandbox SSD');
    expect(ssd?.variants).toHaveLength(4);
    expect(ssd?.externalStatus).toBe('NORMAL');
  });

  it('returns the position-0 image and both translations', async () => {
    await upsertCatalogueItem(twoTierSnapshot(), T1);
    const prisma = getPrisma();
    const product = await prisma.product.findFirstOrThrow();
    await prisma.product.update({ where: { id: product.id }, data: { isActive: true } });
    await prisma.productTranslation.create({
      data: { productId: product.id, locale: 'en', name: 'Sandbox SSD EN', description: 'd' },
    });

    const [candidate] = await listStorefrontCandidates();
    expect(candidate?.imageUrl).toBe('https://cf.shopee.co.th/file/sg-11134201-81z1k-muj2ro5yyn7mb3');
    expect(candidate?.names).toEqual({ th: 'Sandbox SSD', en: 'Sandbox SSD EN' });
  });
});
