import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { StorefrontCandidate } from '@/server/services/catalogue/landing-catalogue-service';
import {
  getStorefrontListing,
  type StorefrontCategory,
  type StorefrontListing,
  type StorefrontListingSearchParams,
} from '@/server/services/catalogue/storefront-listing-service';

const TREE: StorefrontCategory[] = [
  { id: 'ps', slug: 'playstation-5', parentId: null, position: 2, names: { th: 'PlayStation 5' } },
  { id: 'ps-game', slug: 'playstation-5-game', parentId: 'ps', position: 2, names: { th: 'แผ่นเกม' } },
];

const ROW: StorefrontCandidate = {
  productId: 'p1',
  isActive: true,
  externalStatus: 'NORMAL',
  names: { th: 'สินค้า' },
  imageUrl: null,
  isKit: false,
  salesCount: 1,
  isPreOrder: false,
  releaseDate: null,
  variants: [{ priceSatang: 100n, originalPriceSatang: 100n, stockQuantity: 1, isActive: true }],
};

// The real service over in-memory reads: the page logic is what is under test, not the SQL.
vi.mock('@/server/composition-root', () => ({
  getStorefrontListingReader:
    () => (searchParams: StorefrontListingSearchParams, locale: 'th' | 'en') =>
      getStorefrontListing(
        {
          listStorefrontCategories: async () => TREE,
          listStorefrontProducts: async () => ({ rows: [ROW], total: 1 }),
          countStorefrontFacets: async () => ({
            categories: new Map(),
            types: new Map(),
            inStock: 1,
            kit: 0,
            preOrder: 0,
          }),
        },
        searchParams,
        locale,
      ),
}));
vi.mock('../_components/read-articles-menu', () => ({ readArticlesMenu: async () => [] }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async () => (key: string, values?: { name?: string }) => `${key}:${values?.name ?? ''}`,
}));

const { default: ProductListPage, generateMetadata } = await import('./page');

type Outcome = { status: 200; listing: StorefrontListing } | { status: 404 };

/** What the page answers: its view's listing, or a 404 from `notFound()`; any other error fails the test. */
async function visit(searchParams: StorefrontListingSearchParams, locale = 'th'): Promise<Outcome> {
  try {
    const element = (await ProductListPage({
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve(searchParams),
    })) as ReactElement<{ listing: StorefrontListing }>;
    return { status: 200, listing: element.props.listing };
  } catch (error) {
    if ((error as { digest?: string }).digest?.includes('404')) return { status: 404 };
    throw error;
  }
}

describe('the product listing page', () => {
  it('rejects or ignores invalid params without throwing', async () => {
    // R2: a bad price is ignored, the page still answers.
    const badMin = await visit({ min: 'abc', max: '-5' });
    expect(badMin.status).toBe(200);
    if (badMin.status === 200) expect([badMin.listing.active.minBaht, badMin.listing.active.maxBaht]).toEqual([null, null]);
    expect((await visit({ min: '9'.repeat(40) })).status).toBe(200);
    expect((await visit({ min: '1e5' })).status).toBe(200);

    // R2: an invalid page, or an unknown category, type, sort or view, is a real 404.
    for (const searchParams of [
      { page: '0' },
      { page: '-1' },
      { page: '2abc' },
      { page: '99999999999999999999' },
      { page: '2' }, // past the end: one product, one page
      { sort: 'drop' },
      { sort: "price_asc'; DROP TABLE product;--" },
      { view: 'table' },
      { category: '../x' },
      { category: '%2e%2e%2fx' },
      { category: 'playstation-5-game' }, // a type is not a category
      { type: Array.from({ length: 1000 }, () => 'x') },
      { type: [...Array.from({ length: 999 }, () => 'playstation-5-game'), '../x'] },
      { sort: ['newest', 'price_asc'] },
    ]) {
      expect(await visit(searchParams), JSON.stringify(searchParams).slice(0, 80)).toEqual({ status: 404 });
    }

    // A known type repeated 1000 times is used once.
    const repeated = await visit({ type: Array.from({ length: 1000 }, () => 'playstation-5-game') });
    expect(repeated.status).toBe(200);
    if (repeated.status === 200) expect(repeated.listing.active.types).toEqual(['playstation-5-game']);

    // Empty values count as absent; an unknown locale is a 404.
    expect((await visit({ category: '', type: '', sort: '', page: '' })).status).toBe(200);
    expect(await visit({}, 'fr')).toEqual({ status: 404 });
  });

  it('titles the page with the active category, and leaves the layout title otherwise', async () => {
    const meta = (searchParams: StorefrontListingSearchParams) =>
      generateMetadata({ params: Promise.resolve({ locale: 'th' }), searchParams: Promise.resolve(searchParams) });
    expect(await meta({ category: 'playstation-5' })).toEqual({ title: 'categoryTitle:PlayStation 5' });
    expect(await meta({})).toEqual({});
    expect(await meta({ sort: 'drop' })).toEqual({});
  });
});
