import { describe, expect, it, vi } from 'vitest';

import type { StorefrontCandidate } from './landing-catalogue-service';
import {
  getStorefrontListing,
  parseStorefrontListingParams,
  toStorefrontListingFilter,
  type StorefrontCategory,
  type StorefrontListingDeps,
  type StorefrontListingFacetCounts,
} from './storefront-listing-service';

const TREE: StorefrontCategory[] = [
  { id: 'ps', slug: 'playstation-5', parentId: null, position: 2, names: { th: 'PlayStation 5', en: 'PlayStation 5' } },
  { id: 'sw', slug: 'nintendo-switch', parentId: null, position: 1, names: { th: 'Nintendo Switch' } },
  { id: 'ps-game', slug: 'playstation-5-game', parentId: 'ps', position: 2, names: { th: 'แผ่นเกม', en: 'Games' } },
  { id: 'ps-console', slug: 'playstation-5-console', parentId: 'ps', position: 1, names: { th: 'เครื่องเกม', en: 'Consoles' } },
  { id: 'sw-game', slug: 'nintendo-switch-game', parentId: 'sw', position: 2, names: { th: 'แผ่นเกม' } },
];

const parse = (params: Record<string, string | string[] | undefined>) => parseStorefrontListingParams(params, TREE);

describe('parseStorefrontListingParams', () => {
  it('defaults to page 1, recommended, grid and no filters', () => {
    expect(parse({})).toEqual({
      category: null,
      types: [],
      minBaht: null,
      maxBaht: null,
      inStock: false,
      kit: false,
      preOrder: false,
      sort: 'recommended',
      view: 'grid',
      page: 1,
    });
  });

  it('reads every param', () => {
    expect(
      parse({
        category: 'playstation-5',
        type: ['playstation-5-game', 'playstation-5-console', 'playstation-5-game'],
        min: '1000',
        max: '2000',
        in_stock: '1',
        kit: '1',
        pre_order: '1',
        sort: 'price_desc',
        view: 'list',
        page: '3',
      }),
    ).toEqual({
      category: 'playstation-5',
      types: ['playstation-5-game', 'playstation-5-console'],
      minBaht: 1000,
      maxBaht: 2000,
      inStock: true,
      kit: true,
      preOrder: true,
      sort: 'price_desc',
      view: 'list',
      page: 3,
    });
  });

  it('drops a known type of another platform when a category is chosen', () => {
    expect(parse({ category: 'playstation-5', type: ['nintendo-switch-game', 'playstation-5-game'] })?.types).toEqual([
      'playstation-5-game',
    ]);
    expect(parse({ category: 'playstation-5', type: 'nintendo-switch-game' })?.types).toEqual([]);
    expect(parse({ type: ['nintendo-switch-game', 'playstation-5-game'] })?.types).toEqual([
      'nintendo-switch-game',
      'playstation-5-game',
    ]);
    // An unknown type is still a 404, chosen category or not.
    expect(parse({ category: 'playstation-5', type: 'xbox-game' })).toBeNull();
  });

  it.each([
    ['page 0', { page: '0' }],
    ['a negative page', { page: '-1' }],
    ['a padded page', { page: '02' }],
    ['a page with junk', { page: '2abc' }],
    ['a page over 10000', { page: '10001' }],
    ['a huge page', { page: '9'.repeat(400) }],
    ['a repeated page', { page: ['1', '2'] }],
    ['an unknown sort', { sort: 'drop' }],
    ['an unknown view', { view: 'table' }],
    ['an unknown category', { category: '../x' }],
    ['a type slug as category', { category: 'playstation-5-game' }],
    ['a repeated category', { category: ['playstation-5', 'nintendo-switch'] }],
    ['an unknown type', { type: ['playstation-5-game', 'nope'] }],
    ['a platform slug as type', { type: 'playstation-5' }],
  ])('answers 404 (null) for %s', (_label, params) => {
    expect(parse(params)).toBeNull();
  });

  it('accepts page 10000', () => {
    expect(parse({ page: '10000' })?.page).toBe(10000);
  });

  it('ignores a bad min or max and swaps min > max', () => {
    expect(parse({ min: 'abc', max: '-5' })).toMatchObject({ minBaht: null, maxBaht: null });
    expect(parse({ min: '1.5', max: '' })).toMatchObject({ minBaht: null, maxBaht: null });
    expect(parse({ min: '9'.repeat(30) })).toMatchObject({ minBaht: null });
    expect(parse({ min: '5000', max: '100' })).toMatchObject({ minBaht: 100, maxBaht: 5000 });
    expect(parse({ min: '0' })).toMatchObject({ minBaht: 0 });
  });

  it('turns a flag on only for 1', () => {
    expect(parse({ in_stock: 'true', kit: '0', pre_order: ['1', '1'] })).toMatchObject({
      inStock: false,
      kit: false,
      preOrder: false,
    });
  });

  it('reads at most 20 distinct types and ignores the rest', () => {
    const many = Array.from({ length: 1000 }, () => 'playstation-5-game');
    expect(parse({ type: many })?.types).toEqual(['playstation-5-game']);

    const tree: StorefrontCategory[] = [
      TREE[0]!,
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `t${i}`,
        slug: `t${i}`,
        parentId: 'ps',
        position: i,
        names: {},
      })),
    ];
    const params = Array.from({ length: 30 }, (_, i) => `t${i}`);
    expect(parseStorefrontListingParams({ type: params }, tree)?.types).toEqual(params.slice(0, 20));
    // An unknown slug is a 404 even after the 20th distinct one.
    expect(parseStorefrontListingParams({ type: [...params, 'unknown'] }, tree)).toBeNull();
  });

  it('treats an empty value as absent', () => {
    expect(
      parse({ category: '', sort: '', view: '', page: '', min: '', max: '', type: '', in_stock: '' }),
    ).toEqual(parse({}));
    expect(parse({ category: ['', ''], sort: ['', 'newest'], page: ['', '2'], type: ['', 'playstation-5-game', ''] })).toMatchObject({
      category: null,
      sort: 'newest',
      page: 2,
      types: ['playstation-5-game'],
    });
    expect(parse({ min: ['', '100'], max: ['', ''] })).toMatchObject({ minBaht: 100, maxBaht: null });
  });

  it('still answers 404 for a repeated non-empty value', () => {
    expect(parse({ sort: ['newest', 'newest'] })).toBeNull();
    expect(parse({ category: ['', 'playstation-5', 'playstation-5'] })).toBeNull();
  });
});

describe('toStorefrontListingFilter', () => {
  it('maps slugs to ids and baht to satang, max covering every satang below the next baht', () => {
    const params = parse({ category: 'playstation-5', type: 'playstation-5-game', min: '10', max: '20', page: '2' });
    expect(toStorefrontListingFilter(params!, TREE)).toEqual({
      categoryId: 'ps',
      typeIds: ['ps-game'],
      categoryFacetTypeIds: ['ps-game', 'sw-game'],
      minSatang: 1000n,
      maxSatang: 2099n,
      inStock: false,
      kit: false,
      preOrder: false,
      sort: 'recommended',
      page: 2,
      pageSize: 24,
    });
  });
});

describe('toStorefrontListingFilter categoryFacetTypeIds', () => {
  it('matches the platform facet by kind: every platform\'s type of each chosen kind (R1 refinement, D-148)', () => {
    const consoles = toStorefrontListingFilter(parse({ type: 'playstation-5-console' })!, TREE);
    expect(consoles.typeIds).toEqual(['ps-console']);
    expect(consoles.categoryFacetTypeIds).toEqual(['ps-console']);
    const both = toStorefrontListingFilter(parse({ type: ['playstation-5-game', 'nintendo-switch-game'] })!, TREE);
    expect(both.categoryFacetTypeIds).toEqual(['ps-game', 'sw-game']);
  });

  it('is empty without a type', () => {
    expect(toStorefrontListingFilter(parse({ category: 'playstation-5' })!, TREE).categoryFacetTypeIds).toEqual([]);
  });

  it('keeps a type whose slug is outside the {platform}-{kind} pattern as itself', () => {
    const tree: StorefrontCategory[] = [
      ...TREE,
      { id: 'ps-odd', slug: 'ps-odd', parentId: 'ps', position: 9, names: { th: 'อื่นๆ' } },
    ];
    const filter = toStorefrontListingFilter(parseStorefrontListingParams({ type: 'ps-odd' }, tree)!, tree);
    expect(filter.categoryFacetTypeIds).toEqual(['ps-odd']);
  });
});

function row(productId: string): StorefrontCandidate {
  return {
    productId,
    isActive: true,
    externalStatus: 'NORMAL',
    names: { th: `ชื่อ ${productId}`, en: `Name ${productId}` },
    imageUrl: null,
    isKit: false,
    salesCount: 1,
    isPreOrder: false,
    releaseDate: null,
    variants: [{ priceSatang: 100n, originalPriceSatang: 100n, stockQuantity: 1, isActive: true }],
  };
}

function deps(total: number, counts: Partial<StorefrontListingFacetCounts> = {}): StorefrontListingDeps {
  return {
    listStorefrontCategories: async () => TREE,
    listStorefrontProducts: vi.fn(async () => ({ rows: [row('a'), row('b')], total })),
    countStorefrontFacets: vi.fn(async () => ({
      categories: new Map([['ps', 7]]),
      types: new Map([['ps-game', 4]]),
      inStock: 3,
      kit: 1,
      preOrder: 0,
      ...counts,
    })),
  };
}

describe('getStorefrontListing', () => {
  it('maps rows to cards and counts to the sidebar in tree order', async () => {
    const listing = await getStorefrontListing(deps(50), { page: '3' }, 'en');
    expect(listing?.cards.map((c) => c.name)).toEqual(['Name a', 'Name b']);
    expect(listing).toMatchObject({ total: 50, page: 3, totalPages: 3 });
    expect(listing?.facets.categories).toEqual([
      { slug: 'nintendo-switch', name: 'Nintendo Switch', count: 0 },
      { slug: 'playstation-5', name: 'PlayStation 5', count: 7 },
    ]);
    expect(listing?.facets.types.map((t) => [t.slug, t.parentSlug, t.name, t.count])).toEqual([
      ['nintendo-switch-game', 'nintendo-switch', 'แผ่นเกม', 0],
      ['playstation-5-console', 'playstation-5', 'Consoles', 0],
      ['playstation-5-game', 'playstation-5', 'Games', 4],
    ]);
    expect(listing?.facets).toMatchObject({ inStock: 3, kit: 1, preOrder: 0 });
  });

  it('answers null for invalid params without querying products', async () => {
    const d = deps(10);
    expect(await getStorefrontListing(d, { sort: 'drop' }, 'th')).toBeNull();
    expect(d.listStorefrontProducts).not.toHaveBeenCalled();
  });

  it('answers null for a page past the end, but page 1 of an empty result', async () => {
    expect(await getStorefrontListing(deps(48), { page: '3' }, 'th')).toBeNull();
    expect(await getStorefrontListing(deps(48), { page: '2' }, 'th')).not.toBeNull();
    expect((await getStorefrontListing(deps(0), {}, 'th'))?.totalPages).toBe(1);
  });
});
