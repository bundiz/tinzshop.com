/**
 * The storefront listing (plan 013, D-145, D-146): turns the listing page's URL search params into one
 * filter, asks the repository for one page and the facet counts, and maps the rows to cards. Framework-
 * free: filtering, sorting, counting and paging all run in SQL in the repository.
 */
import {
  isStorefrontVisible,
  pickProductName,
  toLandingProductCard,
  type LandingProductCard,
  type Locale,
  type StorefrontCandidate,
} from './landing-catalogue-service';

export const STOREFRONT_LISTING_PAGE_SIZE = 24;
/** The highest `page` accepted; anything above is a 404 without a query. */
export const STOREFRONT_LISTING_MAX_PAGE = 10_000;
/** At most this many distinct `type` values are used; further known ones are ignored (unknown ones are a 404). */
export const STOREFRONT_LISTING_MAX_TYPES = 20;
/** A `min`/`max` longer than this many digits is ignored, so the satang value always fits a bigint. */
const MAX_BAHT_DIGITS = 12;

export const STOREFRONT_LISTING_SORTS = ['recommended', 'best_selling', 'newest', 'price_asc', 'price_desc'] as const;
export type StorefrontListingSort = (typeof STOREFRONT_LISTING_SORTS)[number];
export const STOREFRONT_LISTING_VIEWS = ['grid', 'list'] as const;
export type StorefrontListingView = (typeof STOREFRONT_LISTING_VIEWS)[number];

/** One `category` row as the listing reads it: platforms have no parent, product types do. */
export type StorefrontCategory = {
  id: string;
  slug: string;
  parentId: string | null;
  position: number;
  names: { th?: string; en?: string };
};

/** Next's `searchParams` shape. */
export type StorefrontListingSearchParams = Record<string, string | string[] | undefined>;

/** The validated URL state (R2): what the page echoes back as the active filters. */
export type StorefrontListingParams = {
  category: string | null;
  types: string[];
  minBaht: number | null;
  maxBaht: number | null;
  inStock: boolean;
  kit: boolean;
  preOrder: boolean;
  sort: StorefrontListingSort;
  view: StorefrontListingView;
  page: number;
};

/** What the repository queries: category ids, satang bounds, sort and one page. */
export type StorefrontListingFilter = {
  categoryId: string | null;
  typeIds: string[];
  /** Inclusive lower bound. */
  minSatang: bigint | null;
  /** Inclusive upper bound: `max` baht means below `max + 1` baht, so `max=999` covers ฿999.99 (D-148). */
  maxSatang: bigint | null;
  inStock: boolean;
  kit: boolean;
  preOrder: boolean;
  sort: StorefrontListingSort;
  page: number;
  pageSize: number;
};

/** One page of products, in the filter's order, plus how many match in all. */
export type StorefrontListingPage = { rows: StorefrontCandidate[]; total: number };

/** Facet counts (R1): each applies every active filter except its own dimension; ids are category ids. */
export type StorefrontListingFacetCounts = {
  categories: Map<string, number>;
  types: Map<string, number>;
  inStock: number;
  kit: number;
  preOrder: number;
};

export type StorefrontListingFacets = {
  categories: { slug: string; name: string; count: number }[];
  types: { slug: string; parentSlug: string; name: string; count: number }[];
  inStock: number;
  kit: number;
  preOrder: number;
};

export type StorefrontListing = {
  cards: LandingProductCard[];
  total: number;
  page: number;
  totalPages: number;
  facets: StorefrontListingFacets;
  active: StorefrontListingParams;
};

export type StorefrontListingDeps = {
  listStorefrontCategories: () => Promise<StorefrontCategory[]>;
  listStorefrontProducts: (filter: StorefrontListingFilter) => Promise<StorefrontListingPage>;
  countStorefrontFacets: (filter: StorefrontListingFilter) => Promise<StorefrontListingFacetCounts>;
};

const PAGE = /^[1-9][0-9]*$/;
const BAHT = /^[0-9]+$/;

/** A param's non-empty values: an empty value (`category=`) counts as absent, as an empty form field sends it. */
function values(value: string | string[] | undefined): string[] {
  return (value === undefined ? [] : [value].flat()).filter((text) => text !== '');
}

/** A single-valued param: absent or empty is `undefined`; two non-empty values are `null` (invalid). */
function single(value: string | string[] | undefined): string | undefined | null {
  const present = values(value);
  if (present.length > 1) return null;
  return present[0];
}

function baht(value: string | string[] | undefined): number | null {
  const text = single(value);
  if (typeof text !== 'string' || !BAHT.test(text) || text.length > MAX_BAHT_DIGITS) return null;
  return Number(text);
}

function oneOf<T extends string>(allowed: readonly T[], value: string): value is T {
  return (allowed as readonly string[]).includes(value);
}

/**
 * Validates the listing's search params (R2). An empty value counts as absent. `null` means a 404: a
 * `page` that is not a plain positive integer up to 10,000, or an unknown `category`, `type`, `sort` or
 * `view`, or one of those given twice with non-empty values (`type` excepted, which repeats; at most 20
 * distinct types are used, after every one is checked). A bad `min` or `max` is dropped, and `min > max`
 * is swapped. A flag is on only for the value `1`. With a `category`, a known `type` of another platform is
 * dropped (D-148). Category slugs are checked against the stored tree: `category` must be a
 * platform (no parent) and each `type` a product type (has a parent). Never throws.
 */
export function parseStorefrontListingParams(
  searchParams: StorefrontListingSearchParams,
  categories: readonly StorefrontCategory[],
): StorefrontListingParams | null {
  const pageText = single(searchParams.page);
  if (pageText === null) return null;
  let page = 1;
  if (pageText !== undefined) {
    if (!PAGE.test(pageText) || pageText.length > 5) return null;
    page = Number(pageText);
    if (page > STOREFRONT_LISTING_MAX_PAGE) return null;
  }

  const sortText = single(searchParams.sort);
  if (sortText === null) return null;
  const sort = sortText ?? 'recommended';
  if (!oneOf(STOREFRONT_LISTING_SORTS, sort)) return null;

  const viewText = single(searchParams.view);
  if (viewText === null) return null;
  const view = viewText ?? 'grid';
  if (!oneOf(STOREFRONT_LISTING_VIEWS, view)) return null;

  const platforms = new Set(categories.filter((c) => c.parentId === null).map((c) => c.slug));
  const typeSlugs = new Set(categories.filter((c) => c.parentId !== null).map((c) => c.slug));

  const categoryText = single(searchParams.category);
  if (categoryText === null) return null;
  const category = categoryText ?? null;
  if (category !== null && !platforms.has(category)) return null;

  // Every distinct slug is checked before the cap, so an unknown one is always a 404 wherever it comes.
  const distinctTypes = [...new Set(values(searchParams.type))];
  if (distinctTypes.some((slug) => !typeSlugs.has(slug))) return null;
  // A type outside the chosen platform could never match (AND), so it is dropped rather than shown as chosen.
  const categoryId = category === null ? null : categories.find((c) => c.slug === category && c.parentId === null)?.id;
  const parentOf = new Map(categories.map((c) => [c.slug, c.parentId]));
  const types = distinctTypes
    .filter((slug) => categoryId === null || parentOf.get(slug) === categoryId)
    .slice(0, STOREFRONT_LISTING_MAX_TYPES);

  let minBaht = baht(searchParams.min);
  let maxBaht = baht(searchParams.max);
  if (minBaht !== null && maxBaht !== null && minBaht > maxBaht) [minBaht, maxBaht] = [maxBaht, minBaht];

  const flag = (value: string | string[] | undefined): boolean => single(value) === '1';
  return {
    category,
    types,
    minBaht,
    maxBaht,
    inStock: flag(searchParams.in_stock),
    kit: flag(searchParams.kit),
    preOrder: flag(searchParams.pre_order),
    sort,
    view,
    page,
  };
}

/** The repository filter for validated params; every slug in them is known to `categories`. */
export function toStorefrontListingFilter(
  params: StorefrontListingParams,
  categories: readonly StorefrontCategory[],
): StorefrontListingFilter {
  const idBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const idOf = (slug: string): string => idBySlug.get(slug) ?? '';
  return {
    categoryId: params.category === null ? null : idOf(params.category),
    typeIds: params.types.map(idOf),
    minSatang: params.minBaht === null ? null : BigInt(params.minBaht) * 100n,
    maxSatang: params.maxBaht === null ? null : (BigInt(params.maxBaht) + 1n) * 100n - 1n,
    inStock: params.inStock,
    kit: params.kit,
    preOrder: params.preOrder,
    sort: params.sort,
    page: params.page,
    pageSize: STOREFRONT_LISTING_PAGE_SIZE,
  };
}

function byPosition(a: StorefrontCategory, b: StorefrontCategory): number {
  return a.position - b.position || a.slug.localeCompare(b.slug);
}

/** The sidebar and tabs: every platform and product type in tree order, with zero for an empty one. */
export function toStorefrontListingFacets(
  counts: StorefrontListingFacetCounts,
  categories: readonly StorefrontCategory[],
  locale: Locale,
): StorefrontListingFacets {
  const platforms = categories.filter((c) => c.parentId === null).sort(byPosition);
  const types = platforms.flatMap((platform) =>
    categories
      .filter((c) => c.parentId === platform.id)
      .sort(byPosition)
      .map((type) => ({
        slug: type.slug,
        parentSlug: platform.slug,
        name: pickProductName(type, locale),
        count: counts.types.get(type.id) ?? 0,
      })),
  );
  return {
    categories: platforms.map((platform) => ({
      slug: platform.slug,
      name: pickProductName(platform, locale),
      count: counts.categories.get(platform.id) ?? 0,
    })),
    types,
    inStock: counts.inStock,
    kit: counts.kit,
    preOrder: counts.preOrder,
  };
}

/**
 * One listing page for the URL's search params, or `null` for a 404 (R2): invalid params, or a `page`
 * past the last one. An empty result is still page 1.
 */
export async function getStorefrontListing(
  deps: StorefrontListingDeps,
  searchParams: StorefrontListingSearchParams,
  locale: Locale,
): Promise<StorefrontListing | null> {
  const categories = await deps.listStorefrontCategories();
  const params = parseStorefrontListingParams(searchParams, categories);
  if (params === null) return null;
  const filter = toStorefrontListingFilter(params, categories);
  const [page, counts] = await Promise.all([deps.listStorefrontProducts(filter), deps.countStorefrontFacets(filter)]);
  const totalPages = Math.max(1, Math.ceil(page.total / STOREFRONT_LISTING_PAGE_SIZE));
  if (params.page > totalPages) return null;
  return {
    cards: page.rows.filter(isStorefrontVisible).map((row) => toLandingProductCard(row, locale)),
    total: page.total,
    page: params.page,
    totalPages,
    facets: toStorefrontListingFacets(counts, categories, locale),
    active: params,
  };
}
