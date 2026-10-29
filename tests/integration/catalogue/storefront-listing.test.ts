import { beforeEach, describe, expect, it } from 'vitest';

import { upsertCatalogueItem } from '@/server/repositories/catalogue/catalogue-repository';
import { categoriseProducts } from '@/server/repositories/catalogue/categorise-repository';
import {
  countStorefrontFacets,
  listStorefrontCandidates,
  listStorefrontCategories,
  listStorefrontProducts,
} from '@/server/repositories/catalogue/storefront-repository';
import { getPrisma } from '@/server/repositories/shared/prisma';
import { buildLandingCatalogue } from '@/server/services/catalogue/landing-catalogue-service';
import {
  getStorefrontListing,
  type StorefrontListingSearchParams,
} from '@/server/services/catalogue/storefront-listing-service';
import { resetDatabase } from '../setup/database';
import { noModelSnapshot } from '../fixtures/snapshots';

const T1 = new Date('2026-10-26T01:00:00.000Z');
const deps = { listStorefrontCategories, listStorefrontProducts, countStorefrontFacets };

type Seed = {
  name: string;
  /** Each variant: price in baht, stock, active (default true). */
  variants: [number, number, boolean?][];
  sales?: number;
  kit?: boolean;
  preOrder?: boolean;
  releaseDate?: Date;
  active?: boolean;
  status?: string;
  createdAt?: Date;
};

let nextItemId = 1n;

/** Mirrors one product through the real upsert, then sets the flags only admins or activation set. */
async function seed(item: Seed): Promise<string> {
  const externalItemId = nextItemId++;
  await upsertCatalogueItem(
    noModelSnapshot({
      externalItemId,
      parentSku: `SKU-${externalItemId}`,
      name: item.name,
      externalStatus: item.status ?? 'NORMAL',
      isKit: item.kit ?? false,
      salesCount: item.sales ?? 0,
      externalCreatedAt: item.createdAt ?? T1,
      optionTypes: item.variants.length > 1 ? [{ name: 'Option', values: item.variants.map((_, i) => `v${i}`) }] : [],
      variants: item.variants.map(([baht, stock, active], i) => ({
        externalModelId: item.variants.length > 1 ? externalItemId * 100n + BigInt(i) : null,
        modelSku: `SKU-${externalItemId}-${i}`,
        priceSatang: BigInt(baht) * 100n,
        originalPriceSatang: BigInt(baht) * 100n,
        stockQuantity: stock,
        isActive: active ?? true,
        position: i,
        optionIndexes: item.variants.length > 1 ? [i] : [],
      })),
    }),
    T1,
  );
  const channelItem = await getPrisma().channelItem.findFirstOrThrow({ where: { externalItemId } });
  await getPrisma().product.update({
    where: { id: channelItem.productId },
    data: {
      isActive: item.active ?? true,
      isPreOrder: item.preOrder ?? false,
      releaseDate: item.releaseDate ?? null,
    },
  });
  return channelItem.productId;
}

async function listing(params: StorefrontListingSearchParams) {
  const result = await getStorefrontListing(deps, params, 'th');
  if (result === null) throw new Error('expected a listing, got a 404');
  return result;
}

const names = (cards: { name: string }[]) => cards.map((card) => card.name);
const count = (rows: { slug: string; count: number }[], slug: string) => rows.find((r) => r.slug === slug)?.count;

beforeEach(async () => {
  await resetDatabase();
  nextItemId = 1n;
});

describe('listStorefrontProducts and countStorefrontFacets', () => {
  it('combines filters with AND and counts facets without double counting', async () => {
    await seed({ name: 'PS5 Console Slim', variants: [[15000, 3]] });
    await seed({ name: 'PS5 Game Spider', variants: [[1500, 5]] });
    await seed({ name: 'PS5 Game Sold Out', variants: [[1200, 0]] });
    await seed({ name: 'PS5 Game Deluxe', variants: [[2500, 2]] });
    await seed({ name: 'DualSense Controller', variants: [[2000, 1]], kit: true });
    await seed({ name: 'Nintendo Switch Game Kart', variants: [[1400, 4]], preOrder: true });
    await seed({ name: 'Plain Thing', variants: [[1600, 1]] });
    await categoriseProducts();

    // No filters: each product counts once in its platform, though it is linked to the platform and its type.
    const all = await listing({});
    expect(all.total).toBe(7);
    expect(count(all.facets.categories, 'playstation-5')).toBe(5);
    expect(count(all.facets.categories, 'nintendo-switch')).toBe(1);
    expect(count(all.facets.categories, 'it-gadgets')).toBe(0);
    expect(count(all.facets.types, 'playstation-5-game')).toBe(3);
    const ps5Types = all.facets.types.filter((t) => t.parentSlug === 'playstation-5');
    expect(ps5Types.reduce((sum, t) => sum + t.count, 0)).toBe(5);
    expect(all.facets).toMatchObject({ inStock: 6, kit: 1, preOrder: 1 });

    const filtered = await listing({
      category: 'playstation-5',
      type: 'playstation-5-game',
      min: '1000',
      max: '2000',
      in_stock: '1',
    });
    expect(names(filtered.cards)).toEqual(['PS5 Game Spider']);
    expect(filtered.total).toBe(1);
    // Categories ignore `category`: PS5 games in range and in stock (Spider); no Switch product is a PS5 game.
    expect(count(filtered.facets.categories, 'playstation-5')).toBe(1);
    expect(count(filtered.facets.categories, 'nintendo-switch')).toBe(0);
    // Types ignore `type`: PS5 products in range and in stock (Spider, DualSense), the console is out of range.
    expect(count(filtered.facets.types, 'playstation-5-game')).toBe(1);
    expect(count(filtered.facets.types, 'playstation-5-controller')).toBe(1);
    expect(count(filtered.facets.types, 'playstation-5-console')).toBe(0);
    expect(count(filtered.facets.types, 'nintendo-switch-game')).toBe(0);
    // In stock counts the in-stock PS5 games in range (Spider; Sold Out has none), the same with or without `in_stock`.
    expect(filtered.facets.inStock).toBe(1);
    const unfiltered = await listing({ category: 'playstation-5', type: 'playstation-5-game', min: '1000', max: '2000' });
    expect(unfiltered.total).toBe(2);
    expect(unfiltered.facets.inStock).toBe(1);
    expect(filtered.facets.kit).toBe(0);
    expect(filtered.facets.preOrder).toBe(0);

    // Several types are OR within their dimension, AND with the rest.
    const twoTypes = await listing({
      category: 'playstation-5',
      type: ['playstation-5-game', 'playstation-5-controller'],
      max: '2000',
    });
    expect(names(twoTypes.cards).sort()).toEqual(['DualSense Controller', 'PS5 Game Sold Out', 'PS5 Game Spider']);

    // Flags: kit and pre-order AND with the category.
    const kits = await listing({ kit: '1' });
    expect(names(kits.cards)).toEqual(['DualSense Controller']);
    // The kit count ignores `kit` itself, so selecting it never zeroes the others' counts.
    expect(kits.facets.kit).toBe(1);
    expect(count(kits.facets.categories, 'playstation-5')).toBe(1);
    expect(count(kits.facets.categories, 'nintendo-switch')).toBe(0);
    expect((await listing({ kit: '1', category: 'nintendo-switch' })).total).toBe(0);
    expect(names((await listing({ pre_order: '1', category: 'nintendo-switch' })).cards)).toEqual([
      'Nintendo Switch Game Kart',
    ]);
  });

  it('filters and sorts by the cheapest active variant', async () => {
    // Cheapest active is 500 (sold out); 3000 is in stock; the inactive 100 never counts.
    await seed({ name: 'Multi', variants: [[3000, 2], [500, 0], [100, 9, false]] });
    await seed({ name: 'Single Sold Out', variants: [[500, 0]] });
    await seed({ name: 'Mid', variants: [[800, 1]] });

    expect(names((await listing({ min: '400', max: '600' })).cards).sort()).toEqual(['Multi', 'Single Sold Out']);
    // The sold-out cheapest variant counts for the price, not for "in stock".
    expect(names((await listing({ min: '400', max: '600', in_stock: '1' })).cards)).toEqual(['Multi']);
    expect((await listing({ min: '50', max: '200' })).total).toBe(0);
    // Bounds are inclusive whole baht.
    expect(names((await listing({ min: '800', max: '800' })).cards)).toEqual(['Mid']);

    const asc = names((await listing({ sort: 'price_asc' })).cards);
    expect(asc[2]).toBe('Mid');
    expect(asc.slice(0, 2).sort()).toEqual(['Multi', 'Single Sold Out']);
    const desc = names((await listing({ sort: 'price_desc' })).cards);
    expect(desc[0]).toBe('Mid');
    // Equal prices tie-break by product id, so the two directions list the tie in the same order.
    expect(desc.slice(1)).toEqual(asc.slice(0, 2));

    const multi = (await listing({ min: '400', max: '600' })).cards.find((card) => card.name === 'Multi');
    expect(multi).toMatchObject({ priceSatang: 50000n, isPriceRange: true, stockStatus: 'in_stock' });
  });

  it('pages 24 at a time without overlap', async () => {
    for (let i = 0; i < 50; i++) {
      await seed({ name: `Item ${String(i).padStart(2, '0')}`, variants: [[100 + (i % 3), 1]], sales: i % 2 });
    }
    for (const sort of ['recommended', 'best_selling', 'newest', 'price_asc', 'price_desc']) {
      const pages = [await listing({ sort }), await listing({ sort, page: '2' }), await listing({ sort, page: '3' })];
      expect(pages.map((p) => p.cards.length)).toEqual([24, 24, 2]);
      expect(pages.every((p) => p.total === 50 && p.totalPages === 3)).toBe(true);
      const ids = pages.flatMap((p) => p.cards.map((c) => c.productId));
      expect(new Set(ids).size).toBe(50);
      expect(await getStorefrontListing(deps, { sort, page: '4' }, 'th')).toBeNull();
    }
  });

  it('hides products the visibility rule excludes', async () => {
    await seed({ name: 'PS5 Game Visible', variants: [[1000, 1]], kit: true, preOrder: true });
    await seed({ name: 'PS5 Game Inactive', variants: [[1000, 1]], kit: true, preOrder: true, active: false });
    await seed({ name: 'PS5 Game Unlisted', variants: [[1000, 1]], kit: true, preOrder: true, status: 'UNLIST' });
    await seed({ name: 'PS5 Game No Variant', variants: [[1000, 1, false]], kit: true, preOrder: true });
    await categoriseProducts();

    const all = await listing({});
    expect(names(all.cards)).toEqual(['PS5 Game Visible']);
    expect(all.total).toBe(1);
    expect(count(all.facets.categories, 'playstation-5')).toBe(1);
    expect(count(all.facets.types, 'playstation-5-game')).toBe(1);
    expect(all.facets).toMatchObject({ inStock: 1, kit: 1, preOrder: 1 });
  });

  it('recommended = best-selling with in-stock first', async () => {
    await seed({ name: 'Top Sold Out', variants: [[100, 0]], sales: 100 });
    await seed({ name: 'Low In Stock', variants: [[100, 5]], sales: 10 });
    await seed({ name: 'Mid In Stock', variants: [[100, 0], [200, 1]], sales: 50 });
    await seed({ name: 'Newest', variants: [[100, 1]], sales: 1, createdAt: new Date('2026-10-28T00:00:00Z') });

    expect(names((await listing({})).cards)).toEqual(['Mid In Stock', 'Low In Stock', 'Newest', 'Top Sold Out']);
    expect(names((await listing({ sort: 'best_selling' })).cards)).toEqual([
      'Top Sold Out',
      'Mid In Stock',
      'Low In Stock',
      'Newest',
    ]);
    expect(names((await listing({ sort: 'newest' })).cards)[0]).toBe('Newest');
  });

  it('answers 404 for an unknown category or type from the stored tree', async () => {
    await categoriseProducts();
    expect(await getStorefrontListing(deps, { category: 'xbox' }, 'th')).toBeNull();
    expect(await getStorefrontListing(deps, { type: 'xbox-game' }, 'th')).toBeNull();
    expect(await getStorefrontListing(deps, { category: 'it-gadgets', type: 'it-gadgets-accessory' }, 'th')).not.toBeNull();
  });
});

describe('listStorefrontCandidates (landing, sort and limit in SQL)', () => {
  it('returns only what the three landing sections show, and the same catalogue', async () => {
    for (let i = 0; i < 12; i++) await seed({ name: `Plain ${i}`, variants: [[100, 1]], sales: 100 + i });
    for (let i = 0; i < 8; i++) await seed({ name: `Kit ${i}`, variants: [[100, 1]], sales: i, kit: true });
    for (let i = 0; i < 6; i++) {
      await seed({
        name: `Pre ${i}`,
        variants: [[100, 1]],
        sales: 0,
        preOrder: true,
        releaseDate: new Date(Date.UTC(2026, 11, 10 - i)),
      });
    }
    await seed({ name: 'Hidden Kit', variants: [[100, 1]], sales: 999, kit: true, active: false });

    const candidates = await listStorefrontCandidates();
    expect(candidates.length).toBeLessThanOrEqual(8 + 6 + 4);
    const catalogue = buildLandingCatalogue(candidates, 'th');
    expect(names(catalogue.bestSellers)).toEqual(['Plain 11', 'Plain 10', 'Plain 9', 'Plain 8', 'Plain 7', 'Plain 6', 'Plain 5', 'Plain 4']);
    expect(names(catalogue.bundles)).toEqual(['Kit 7', 'Kit 6', 'Kit 5', 'Kit 4', 'Kit 3', 'Kit 2']);
    expect(names(catalogue.preOrders)).toEqual(['Pre 5', 'Pre 4', 'Pre 3', 'Pre 2']);
  });

  it('keeps ties at the cutoff so the name tie-break matches the old in-memory sort', async () => {
    for (let i = 0; i < 7; i++) await seed({ name: `Top ${i}`, variants: [[100, 1]], sales: 100 + i });
    // The 8th and 9th (and 10th) best sellers tie on sales; seeded out of name order, so ids decide nothing.
    for (const name of ['Tie C', 'Tie A', 'Tie B']) await seed({ name, variants: [[100, 1]], sales: 5 });
    await seed({ name: 'Below', variants: [[100, 1]], sales: 1 });

    const candidates = await listStorefrontCandidates();
    const candidateNames = candidates.map((c) => c.names.th);
    expect(candidateNames.filter((n) => n?.startsWith('Tie')).sort()).toEqual(['Tie A', 'Tie B', 'Tie C']);
    expect(candidateNames).not.toContain('Below');
    const catalogue = buildLandingCatalogue(candidates, 'th');
    expect(catalogue.bestSellers).toHaveLength(8);
    expect(catalogue.bestSellers[7]?.name).toBe('Tie A');
  });
});
