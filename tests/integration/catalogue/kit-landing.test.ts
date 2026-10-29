import { beforeEach, describe, expect, it } from 'vitest';

import { activateSyncedProducts } from '@/server/repositories/catalogue/activation-repository';
import { upsertCatalogueItem } from '@/server/repositories/catalogue/catalogue-repository';
import { findStorefrontProduct, listStorefrontCandidates } from '@/server/repositories/catalogue/storefront-repository';
import { getPrisma } from '@/server/repositories/shared/prisma';
import { buildLandingCatalogue } from '@/server/services/catalogue/landing-catalogue-service';
import { getProductDetail } from '@/server/services/catalogue/product-detail-service';
import { resetDatabase } from '../setup/database';
import { kitSnapshot, noModelSnapshot } from '../fixtures/snapshots';

const T1 = new Date('2026-10-26T01:00:00.000Z');

beforeEach(async () => {
  await resetDatabase();
});

describe('a kit item from the mirror to the storefront', () => {
  it('lands in bundles and best sellers with the cheapest active price, and the page knows it is a kit', async () => {
    await upsertCatalogueItem(kitSnapshot(), T1);
    await upsertCatalogueItem(noModelSnapshot(), T1);
    expect(await activateSyncedProducts()).toBe(2);

    const catalogue = buildLandingCatalogue(await listStorefrontCandidates(), 'th');
    const kit = catalogue.bundles.find((card) => card.name === 'Sandbox Promotion Set');
    expect(catalogue.bundles).toHaveLength(1);
    expect(kit).toBeDefined();
    expect(catalogue.bestSellers.map((card) => card.productId)).toContain(kit?.productId);
    expect(kit?.isKit).toBe(true);
    expect(kit?.priceSatang).toBe(1490000n);
    expect(kit?.isPriceRange).toBe(true);
    expect(kit?.stockStatus).toBe('in_stock');

    const normal = catalogue.bestSellers.find((card) => card.name === 'Sandbox Kart Game');
    expect(normal?.isKit).toBe(false);
    expect(catalogue.bundles.map((card) => card.productId)).not.toContain(normal?.productId);

    const product = await getPrisma().product.findFirstOrThrow({ where: { parentSku: 'SBX-KIT-01' } });
    const detail = await getProductDetail({ findStorefrontProduct }, product.id, 'th');
    expect(detail?.isKit).toBe(true);
    const normalProduct = await getPrisma().product.findFirstOrThrow({ where: { parentSku: 'SBX-SW-MK8' } });
    expect((await getProductDetail({ findStorefrontProduct }, normalProduct.id, 'th'))?.isKit).toBe(false);
  });
});
