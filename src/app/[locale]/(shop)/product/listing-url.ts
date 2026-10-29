/**
 * The product listing's URLs (plan 013, D-145): turns a listing state into `/{locale}/product?…` and works
 * out the next state for a change. Pure, so the server-rendered links and the client filter controls build
 * the same URLs, and it is tested without a browser.
 */
import type { ProductTypeKey } from '@/server/services/catalogue/categorise-by-name';
import type {
  StorefrontListingFacets,
  StorefrontListingParams,
} from '@/server/services/catalogue/storefront-listing-service';

/** The listing with no filter: what "ล้างทั้งหมด" returns to, sort and view aside. */
export const DEFAULT_LISTING: StorefrontListingParams = {
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
};

/** The product-type kinds in the design's tab order (D-143: a type's slug is `{platform}-{kind}`). */
export const PRODUCT_TYPE_KINDS: readonly ProductTypeKey[] = ['console', 'game', 'controller', 'accessory'];

/** The header nav's platform entries and their category slugs (D-143). */
export const NAV_CATEGORY_SLUGS = {
  switch: 'nintendo-switch',
  ps5: 'playstation-5',
  gadgets: 'it-gadgets',
} as const;

const wholeBaht = (value: number | null): value is number =>
  value !== null && Number.isSafeInteger(value) && value >= 0;

/**
 * The query string for a state, `?…` or `''`: params in a fixed order, and only those that differ from the
 * default, so the URL never carries an empty or default value.
 */
export function listingQuery(state: StorefrontListingParams): string {
  const search = new URLSearchParams();
  if (state.category !== null && state.category !== '') search.append('category', state.category);
  for (const type of new Set(state.types)) if (type !== '') search.append('type', type);
  let min = wholeBaht(state.minBaht) ? state.minBaht : null;
  let max = wholeBaht(state.maxBaht) ? state.maxBaht : null;
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  if (min !== null) search.append('min', String(min));
  if (max !== null) search.append('max', String(max));
  if (state.inStock) search.append('in_stock', '1');
  if (state.kit) search.append('kit', '1');
  if (state.preOrder) search.append('pre_order', '1');
  if (state.sort !== 'recommended') search.append('sort', state.sort);
  if (state.view !== 'grid') search.append('view', state.view);
  if (state.page > 1) search.append('page', String(state.page));
  const query = search.toString();
  return query === '' ? '' : `?${query}`;
}

/** The listing's path for a state. */
export function listingHref(locale: string, state: Partial<StorefrontListingParams> = {}): string {
  return `/${locale}/product${listingQuery({ ...DEFAULT_LISTING, ...state })}`;
}

/**
 * The state after a change. Any change but `view` or `page` goes back to page 1, since the result set (or
 * its order) changes; a change that names `page` keeps it.
 */
export function nextListing(
  current: StorefrontListingParams,
  change: Partial<StorefrontListingParams>,
): StorefrontListingParams {
  const resetsPage = Object.keys(change).some((key) => key !== 'view' && key !== 'page');
  return { ...current, ...change, page: change.page ?? (resetsPage ? 1 : current.page) };
}

/** Every filter cleared, keeping the sort and the view. */
export function clearedListing(current: StorefrontListingParams): StorefrontListingParams {
  return { ...DEFAULT_LISTING, sort: current.sort, view: current.view };
}

/** Whether any filter (not sort, view or page) is on. */
export function hasListingFilters(state: StorefrontListingParams): boolean {
  return (
    state.category !== null ||
    state.types.length > 0 ||
    state.minBaht !== null ||
    state.maxBaht !== null ||
    state.inStock ||
    state.kit ||
    state.preOrder
  );
}

type FacetType = StorefrontListingFacets['types'][number];

/** A type's kind, read from its slug `{platform}-{kind}`; `null` for a slug outside that pattern. */
export function typeKind(type: Pick<FacetType, 'slug' | 'parentSlug'>): ProductTypeKey | null {
  return PRODUCT_TYPE_KINDS.find((kind) => type.slug === `${type.parentSlug}-${kind}`) ?? null;
}

/** The types in scope: the active platform's, or every platform's when none is chosen. */
function typesInScope(types: readonly FacetType[], category: string | null): FacetType[] {
  return types.filter((type) => category === null || type.parentSlug === category);
}

/** The slugs of one kind in scope, e.g. every `…-console` (or only `playstation-5-console` on PS5). */
export function kindSlugs(types: readonly FacetType[], kind: ProductTypeKey, category: string | null): string[] {
  return typesInScope(types, category)
    .filter((type) => typeKind(type) === kind)
    .map((type) => type.slug);
}

/** The kinds the selected types belong to, in tab order. */
export function selectedKinds(types: readonly FacetType[], selected: readonly string[]): ProductTypeKey[] {
  const kinds = new Set(
    types.filter((type) => selected.includes(type.slug)).map(typeKind).filter((kind) => kind !== null),
  );
  return PRODUCT_TYPE_KINDS.filter((kind) => kinds.has(kind));
}

/** One kind's count in scope: the sum over its types, each product counted once per type (R1). */
export function kindCount(types: readonly FacetType[], kind: ProductTypeKey, category: string | null): number {
  return typesInScope(types, category)
    .filter((type) => typeKind(type) === kind)
    .reduce((sum, type) => sum + type.count, 0);
}

/** The types after switching on or off one kind, within the current scope. */
export function toggleKind(
  types: readonly FacetType[],
  state: StorefrontListingParams,
  kind: ProductTypeKey,
): string[] {
  const ofKind = new Set(types.filter((type) => typeKind(type) === kind).map((type) => type.slug));
  const without = state.types.filter((slug) => !ofKind.has(slug));
  return selectedKinds(types, state.types).includes(kind)
    ? without
    : [...without, ...kindSlugs(types, kind, state.category)];
}

/** The state after choosing a platform (or `null` for all): the chosen kinds carry over to its types. */
export function withCategory(
  types: readonly FacetType[],
  state: StorefrontListingParams,
  category: string | null,
): StorefrontListingParams {
  const kinds = selectedKinds(types, state.types);
  return nextListing(state, {
    category,
    types: kinds.flatMap((kind) => kindSlugs(types, kind, category)),
  });
}
