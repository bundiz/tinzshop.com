import { beforeEach, describe, expect, it } from 'vitest';

import {
  listKnownItems,
  markItemsNotFound,
  upsertCatalogueItem,
} from '@/server/repositories/catalogue/catalogue-repository';
import { getPrisma } from '@/server/repositories/shared/prisma';
import {
  findLastSucceededSyncRun,
  finishSyncRun,
  recordSkippedSyncRun,
  startSyncRun,
} from '@/server/repositories/catalogue/sync-run-repository';
import { resetDatabase } from '../setup/database';
import { noModelSnapshot, twoTierSnapshot } from '../fixtures/snapshots';

const T1 = new Date('2026-10-26T01:00:00.000Z');
const T2 = new Date('2026-10-26T02:00:00.000Z');

beforeEach(async () => {
  await resetDatabase();
});

async function variantsByModel(): Promise<Map<bigint | null, { id: string; isActive: boolean; priceSatang: bigint; stockQuantity: number }>> {
  const rows = await getPrisma().variant.findMany({ include: { channelListing: true } });
  return new Map(
    rows.map((row) => [
      row.channelListing?.externalModelId ?? null,
      { id: row.id, isActive: row.isActive, priceSatang: row.priceSatang, stockQuantity: row.stockQuantity },
    ]),
  );
}

describe('upsertCatalogueItem', () => {
  it('keeps stored sales and rating when the snapshot has none', async () => {
    await upsertCatalogueItem(noModelSnapshot(), T1);
    await upsertCatalogueItem(noModelSnapshot({ salesCount: null, ratingStar: null, ratingCount: null }), T2);
    const row = await getPrisma().channelItem.findFirstOrThrow();
    expect([row.salesCount, Number(row.ratingStar), row.ratingCount]).toEqual([5, 4.5, 2]);
  });

  it('stores zeros on create when the snapshot has no sales data', async () => {
    await upsertCatalogueItem(noModelSnapshot({ salesCount: null, ratingStar: null, ratingCount: null }), T1);
    const row = await getPrisma().channelItem.findFirstOrThrow();
    expect([row.salesCount, Number(row.ratingStar), row.ratingCount]).toEqual([0, 0, 0]);
  });

  it('creates an inactive product with its variants', async () => {
    const snapshot = twoTierSnapshot();
    expect(await upsertCatalogueItem(snapshot, T1)).toBe('created');

    const prisma = getPrisma();
    const products = await prisma.product.findMany({ include: { translations: true, images: true } });
    expect(products).toHaveLength(1);
    expect(products[0]?.isActive).toBe(false);
    expect(products[0]?.parentSku).toBe('SBX-IT-SSD');
    expect(products[0]?.images).toHaveLength(2);
    const th = products[0]?.translations.find((t) => t.locale === 'th');
    expect(th?.name).toBe(snapshot.name);
    expect(await prisma.variant.count()).toBe(4);
    expect(await prisma.optionType.count()).toBe(2);
    expect(await prisma.optionValue.count()).toBe(4);
    expect(await prisma.variantOptionValue.count()).toBe(8);
    expect(await prisma.channelListing.count()).toBe(4);
    const item = await prisma.channelItem.findFirstOrThrow();
    expect(item.externalItemId).toBe(803947690n);
    expect(item.lastSyncedAt).toEqual(T1);
  });

  it('stores a raw payload containing bigints as strings', async () => {
    await upsertCatalogueItem(
      twoTierSnapshot({ rawPayload: { item_id: 803947690n, nested: [{ model_id: 12998741n }] } }),
      T1,
    );
    const item = await getPrisma().channelItem.findFirstOrThrow();
    expect(item.rawPayload).toEqual({ item_id: '803947690', nested: [{ model_id: '12998741' }] });
  });

  it('updates in place on the second sync', async () => {
    await upsertCatalogueItem(twoTierSnapshot(), T1);
    const before = await variantsByModel();

    const changed = twoTierSnapshot();
    const variants = changed.variants.map((v) =>
      v.externalModelId === 12998741n ? { ...v, priceSatang: 279000n, stockQuantity: 0 } : v,
    );
    expect(await upsertCatalogueItem({ ...changed, variants }, T2)).toBe('updated');

    const after = await variantsByModel();
    expect(after.size).toBe(4);
    for (const [key, value] of before) expect(after.get(key)?.id).toBe(value.id);
    expect(after.get(12998741n)?.priceSatang).toBe(279000n);
    expect(after.get(12998741n)?.stockQuantity).toBe(0);
    expect(await getPrisma().product.count()).toBe(1);
  });

  it('keeps variant ids stable and deactivates removed models', async () => {
    await upsertCatalogueItem(twoTierSnapshot(), T1);
    const before = await variantsByModel();

    const original = twoTierSnapshot();
    const reverse = (index: number): number => 1 - index;
    const survivors = original.variants
      .filter((v) => v.externalModelId !== 12998740n)
      .map((v) => ({ ...v, optionIndexes: v.optionIndexes.map(reverse) }));
    const reordered = {
      ...original,
      optionTypes: [
        { name: 'Capacity', values: ['2TB', '1TB'] },
        { name: 'Colour', values: ['Blue', 'Black'] },
      ],
      variants: survivors,
    };
    expect(await upsertCatalogueItem(reordered, T2)).toBe('updated');

    const after = await variantsByModel();
    expect(after.size).toBe(4);
    for (const [key, value] of before) expect(after.get(key)?.id).toBe(value.id);
    expect(after.get(12998740n)?.isActive).toBe(false);
    expect(after.get(12998738n)?.isActive).toBe(true);
    const removedListing = await getPrisma().channelListing.findFirstOrThrow({
      where: { externalModelId: 12998740n },
    });
    expect(removedListing.externalStatus).toBe('NOT_FOUND');
    expect(removedListing.lastSyncedAt).toEqual(T2);

    const links = await getPrisma().variantOptionValue.findMany({
      include: { optionValue: { include: { optionType: true } } },
    });
    const namesFor = (variantId: string | undefined): string[] =>
      links
        .filter((l) => l.variantId === variantId)
        .sort((a, b) => a.optionValue.optionType.position - b.optionValue.optionType.position)
        .map((l) => l.optionValue.value);
    expect(namesFor(after.get(12998738n)?.id)).toEqual(['1TB', 'Black']);
    expect(namesFor(after.get(12998741n)?.id)).toEqual(['1TB', 'Blue']);
    expect(namesFor(after.get(12998739n)?.id)).toEqual(['2TB', 'Black']);
    expect(namesFor(after.get(12998740n)?.id)).toEqual([]);
    expect(await getPrisma().optionValue.count()).toBe(4);
  });

  it('preserves admin-owned fields across re-sync', async () => {
    await upsertCatalogueItem(twoTierSnapshot(), T1);
    const prisma = getPrisma();
    const product = await prisma.product.findFirstOrThrow();
    const category = await prisma.category.create({ data: { slug: 'ssd', position: 0 } });
    await prisma.productCategory.create({ data: { productId: product.id, categoryId: category.id } });
    await prisma.shippingSizeTierRate.create({ data: { tier: 'large', priceSatang: 10000n } });
    await prisma.product.update({
      where: { id: product.id },
      data: {
        isActive: true,
        primaryCategoryId: category.id,
        shippingSizeTier: 'large',
        isPreOrder: true,
        releaseDate: new Date('2026-12-01'),
      },
    });
    await prisma.productTranslation.create({
      data: { productId: product.id, locale: 'en', name: 'English name', description: 'English description' },
    });

    expect(await upsertCatalogueItem(twoTierSnapshot({ name: 'Renamed in Shopee', brandName: 'NewBrand' }), T2)).toBe('updated');

    const after = await prisma.product.findFirstOrThrow({
      include: { translations: true, categories: true },
    });
    expect(after.isActive).toBe(true);
    expect(after.primaryCategoryId).toBe(category.id);
    expect(after.shippingSizeTier).toBe('large');
    expect(after.isPreOrder).toBe(true);
    expect(after.releaseDate).toEqual(new Date('2026-12-01'));
    expect(after.categories).toHaveLength(1);
    expect(after.brandName).toBe('NewBrand');
    const en = after.translations.find((t) => t.locale === 'en');
    expect(en?.name).toBe('English name');
    expect(en?.description).toBe('English description');
    expect(after.translations.find((t) => t.locale === 'th')?.name).toBe('Renamed in Shopee');
  });

  it('keeps exactly one variant for an item without models', async () => {
    expect(await upsertCatalogueItem(noModelSnapshot(), T1)).toBe('created');
    expect(await upsertCatalogueItem(noModelSnapshot(), T2)).toBe('updated');
    expect(await getPrisma().variant.count()).toBe(1);
    expect(await getPrisma().channelListing.count()).toBe(1);
  });
});

describe('upsertCatalogueItem update branches', () => {
  it('creates a variant and listing for a model added on update', async () => {
    const original = twoTierSnapshot();
    const [removed, ...rest] = original.variants;
    if (removed === undefined) throw new Error('fixture has no variants');
    await upsertCatalogueItem({ ...original, variants: rest }, T1);
    const before = await variantsByModel();
    expect(before.size).toBe(3);

    expect(await upsertCatalogueItem(original, T2)).toBe('updated');
    const after = await variantsByModel();
    expect(after.size).toBe(4);
    for (const [key, value] of before) expect(after.get(key)?.id).toBe(value.id);
    expect(after.get(removed.externalModelId)?.isActive).toBe(true);
    expect(await getPrisma().channelListing.count()).toBe(4);
    expect(await getPrisma().variantOptionValue.count()).toBe(8);
  });

  it('reactivates the same variant when a removed model reappears', async () => {
    const original = twoTierSnapshot();
    await upsertCatalogueItem(original, T1);
    const before = await variantsByModel();

    const without = { ...original, variants: original.variants.filter((v) => v.externalModelId !== 12998740n) };
    await upsertCatalogueItem(without, T2);
    expect((await variantsByModel()).get(12998740n)?.isActive).toBe(false);
    const gone = await getPrisma().channelListing.findFirstOrThrow({ where: { externalModelId: 12998740n } });
    expect(gone.externalStatus).toBe('NOT_FOUND');

    await upsertCatalogueItem(original, new Date('2026-10-26T03:00:00.000Z'));
    const after = await variantsByModel();
    expect(after.size).toBe(4);
    expect(after.get(12998740n)?.id).toBe(before.get(12998740n)?.id);
    expect(after.get(12998740n)?.isActive).toBe(true);
    const listing = await getPrisma().channelListing.findFirstOrThrow({ where: { externalModelId: 12998740n } });
    expect(listing.externalStatus).toBeNull();
  });

  it('deactivates the null-model variant when an item gains models', async () => {
    await upsertCatalogueItem(noModelSnapshot(), T1);
    const before = await variantsByModel();
    const nullId = before.get(null)?.id;

    const gained = twoTierSnapshot({ externalItemId: 803947687n });
    expect(await upsertCatalogueItem(gained, T2)).toBe('updated');

    const after = await variantsByModel();
    expect(after.size).toBe(5);
    expect(after.get(null)?.id).toBe(nullId);
    expect(after.get(null)?.isActive).toBe(false);
    const nullListing = await getPrisma().channelListing.findFirstOrThrow({ where: { externalModelId: null } });
    expect(nullListing.externalStatus).toBe('NOT_FOUND');
    expect(after.get(12998741n)?.isActive).toBe(true);
    expect(await getPrisma().product.count()).toBe(1);
  });

  it('deactivates model variants and reuses the null-model variant when models disappear', async () => {
    await upsertCatalogueItem(noModelSnapshot(), T1);
    const nullId = (await variantsByModel()).get(null)?.id;
    await upsertCatalogueItem(twoTierSnapshot({ externalItemId: 803947687n }), T2);
    const mid = await variantsByModel();

    expect(await upsertCatalogueItem(noModelSnapshot(), new Date('2026-10-26T03:00:00.000Z'))).toBe('updated');
    const after = await variantsByModel();
    expect(after.size).toBe(5);
    for (const [key, value] of mid) expect(after.get(key)?.id).toBe(value.id);
    expect(after.get(null)?.id).toBe(nullId);
    expect(after.get(null)?.isActive).toBe(true);
    for (const id of [12998738n, 12998739n, 12998740n, 12998741n]) {
      expect(after.get(id)?.isActive).toBe(false);
    }
    expect(await getPrisma().optionType.count()).toBe(0);
    expect(await getPrisma().variantOptionValue.count()).toBe(0);
  });

  it('restores a not-found item when it is upserted again', async () => {
    await upsertCatalogueItem(noModelSnapshot(), T1);
    expect(await markItemsNotFound([803947687n], T2)).toBe(1);
    // A not-found item stays known, so the stock sweep re-checks it every run.
    expect(await listKnownItems()).toEqual([{ externalItemId: 803947687n, externalStatus: 'NOT_FOUND', isKit: false }]);

    expect(await upsertCatalogueItem(noModelSnapshot({ externalStatus: 'UNLIST' }), new Date('2026-10-26T03:00:00.000Z'))).toBe('updated');
    const item = await getPrisma().channelItem.findFirstOrThrow();
    expect(item.externalStatus).toBe('UNLIST');
    expect(await listKnownItems()).toEqual([{ externalItemId: 803947687n, externalStatus: 'UNLIST', isKit: false }]);
    expect(await getPrisma().product.count()).toBe(1);
  });
});

describe('known items', () => {
  it('lists every known item, not-found ones included, and counts only new not-found marks', async () => {
    await upsertCatalogueItem(twoTierSnapshot(), T1);
    await upsertCatalogueItem(noModelSnapshot(), T1);

    expect(await markItemsNotFound([803947687n], T2)).toBe(1);
    expect(await markItemsNotFound([803947687n], T2)).toBe(0);
    const known = await listKnownItems();
    expect(known).toEqual([
      { externalItemId: 803947687n, externalStatus: 'NOT_FOUND', isKit: false },
      { externalItemId: 803947690n, externalStatus: 'NORMAL', isKit: false },
    ]);
  });
});

describe('sync runs', () => {
  it('records sync runs', async () => {
    const id = await startSyncRun({ windowFrom: null, windowTo: T1, startedAt: T1 });
    await finishSyncRun(id, {
      outcome: 'succeeded',
      finishedAt: T2,
      itemsSeen: 2,
      itemsCreated: 1,
      itemsUpdated: 1,
      itemsDeactivated: 0,
      apiCalls: 4,
      warnings: ['one warning'],
    });
    expect(await findLastSucceededSyncRun()).toEqual({ windowTo: T1 });

    const later = new Date('2026-10-26T03:00:00.000Z');
    const failedId = await startSyncRun({ windowFrom: T1, windowTo: later, startedAt: later });
    await finishSyncRun(failedId, {
      outcome: 'failed',
      finishedAt: later,
      itemsSeen: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeactivated: 0,
      apiCalls: 1,
      warnings: [],
      errorCode: 'shopee_error',
      errorDetail: 'boom',
    });
    await recordSkippedSyncRun(later);
    expect(await findLastSucceededSyncRun()).toEqual({ windowTo: T1 });

    const run = await getPrisma().syncRun.findUniqueOrThrow({ where: { id } });
    expect(run.warnings).toEqual(['one warning']);
    expect(run.itemsSeen).toBe(2);
    const skipped = await getPrisma().syncRun.findFirstOrThrow({ where: { outcome: 'skipped' } });
    expect(skipped.windowTo).toBeNull();
    expect(skipped.startedAt).toEqual(later);
    expect(skipped.finishedAt).toEqual(later);
  });

  it('returns null when no run has succeeded', async () => {
    expect(await findLastSucceededSyncRun()).toBeNull();
  });
});
