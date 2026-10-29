import { describe, expect, it } from 'vitest';
import type { StorefrontListingFacets } from '@/server/services/catalogue/storefront-listing-service';
import {
  DEFAULT_LISTING,
  clearedListing,
  kindCount,
  kindSlugs,
  listingHref,
  listingQuery,
  nextListing,
  selectedKinds,
  toggleKind,
  typeKind,
  withCategory,
} from './listing-url';

const TYPES: StorefrontListingFacets['types'] = [
  { slug: 'nintendo-switch-console', parentSlug: 'nintendo-switch', name: 'เครื่องเกม', count: 3 },
  { slug: 'nintendo-switch-game', parentSlug: 'nintendo-switch', name: 'แผ่นเกม', count: 10 },
  { slug: 'playstation-5-console', parentSlug: 'playstation-5', name: 'เครื่องเกม', count: 2 },
  { slug: 'playstation-5-game', parentSlug: 'playstation-5', name: 'แผ่นเกม', count: 7 },
  { slug: 'it-gadgets-accessory', parentSlug: 'it-gadgets', name: 'อุปกรณ์เสริม', count: 5 },
];

describe('listingQuery', () => {
  it('is empty for the default state', () => {
    expect(listingQuery(DEFAULT_LISTING)).toBe('');
    expect(listingHref('th')).toBe('/th/product');
  });

  it('writes every param in a fixed order and leaves out defaults and empties', () => {
    expect(
      listingQuery({
        category: 'playstation-5',
        types: ['playstation-5-game', '', 'playstation-5-game'],
        minBaht: 1000,
        maxBaht: 3000,
        inStock: true,
        kit: true,
        preOrder: true,
        sort: 'price_asc',
        view: 'list',
        page: 2,
      }),
    ).toBe(
      '?category=playstation-5&type=playstation-5-game&min=1000&max=3000&in_stock=1&kit=1&pre_order=1&sort=price_asc&view=list&page=2',
    );
    expect(listingQuery({ ...DEFAULT_LISTING, category: '' })).toBe('');
  });

  it('drops a bad price and swaps min above max', () => {
    expect(listingQuery({ ...DEFAULT_LISTING, minBaht: Number.NaN, maxBaht: -5 })).toBe('');
    expect(listingQuery({ ...DEFAULT_LISTING, minBaht: 1.5 })).toBe('');
    expect(listingQuery({ ...DEFAULT_LISTING, minBaht: 5000, maxBaht: 1000 })).toBe('?min=1000&max=5000');
    expect(listingQuery({ ...DEFAULT_LISTING, minBaht: 0 })).toBe('?min=0');
  });
});

describe('nextListing', () => {
  const onPage3 = { ...DEFAULT_LISTING, category: 'playstation-5', page: 3 };

  it('resets the page to 1 on a filter or sort change', () => {
    expect(nextListing(onPage3, { inStock: true })).toEqual({ ...onPage3, inStock: true, page: 1 });
    expect(nextListing(onPage3, { sort: 'newest' }).page).toBe(1);
    expect(nextListing(onPage3, { minBaht: null }).page).toBe(1);
  });

  it('keeps the page on a view change and takes a page change as given', () => {
    expect(nextListing(onPage3, { view: 'list' })).toEqual({ ...onPage3, view: 'list' });
    expect(nextListing(onPage3, { page: 4 }).page).toBe(4);
  });

  it('builds the next URL from the current one without empty params', () => {
    const current = { ...DEFAULT_LISTING, minBaht: 1000, maxBaht: 3000, page: 2 };
    expect(listingHref('th', nextListing(current, { minBaht: null }))).toBe('/th/product?max=3000');
    expect(listingHref('en', nextListing(current, { maxBaht: null, minBaht: null }))).toBe('/en/product');
  });

  it('clears every filter but keeps sort and view', () => {
    const busy = { ...onPage3, inStock: true, sort: 'price_desc' as const, view: 'list' as const };
    expect(listingQuery(clearedListing(busy))).toBe('?sort=price_desc&view=list');
  });
});

describe('product-type kinds', () => {
  it('reads the kind from the slug', () => {
    expect(typeKind(TYPES[0])).toBe('console');
    expect(typeKind({ slug: 'odd', parentSlug: 'playstation-5' })).toBeNull();
  });

  it('scopes a kind to the active platform, or to every platform', () => {
    expect(kindSlugs(TYPES, 'console', null)).toEqual(['nintendo-switch-console', 'playstation-5-console']);
    expect(kindSlugs(TYPES, 'console', 'playstation-5')).toEqual(['playstation-5-console']);
    expect(kindSlugs(TYPES, 'console', 'it-gadgets')).toEqual([]);
    expect(kindCount(TYPES, 'game', null)).toBe(17);
    expect(kindCount(TYPES, 'game', 'playstation-5')).toBe(7);
  });

  it('toggles a kind on and off', () => {
    const on = toggleKind(TYPES, DEFAULT_LISTING, 'game');
    expect(on).toEqual(['nintendo-switch-game', 'playstation-5-game']);
    expect(selectedKinds(TYPES, on)).toEqual(['game']);
    expect(toggleKind(TYPES, { ...DEFAULT_LISTING, types: on }, 'game')).toEqual([]);
  });

  it('carries the chosen kinds over to another platform', () => {
    const state = { ...DEFAULT_LISTING, types: ['nintendo-switch-game', 'playstation-5-game'], page: 2 };
    expect(withCategory(TYPES, state, 'playstation-5')).toEqual({
      ...state,
      category: 'playstation-5',
      types: ['playstation-5-game'],
      page: 1,
    });
    expect(withCategory(TYPES, state, 'it-gadgets').types).toEqual([]);
  });
});
