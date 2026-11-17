/** One product as the news editor's picker shows it (R3). */
export type ProductPickerHit = { id: string; name: string; sku: string; imageUrl: string | null };

export type ProductSearchDeps = {
  catalogue: {
    searchActiveProducts: (query: string, limit: number) => Promise<ProductPickerHit[]>;
    findProductSummaries: (ids: readonly string[]) => Promise<ProductPickerHit[]>;
  };
};

/** How many products one search or one browse shows (owner, 2026-11-17, D-269). */
export const PRODUCT_SEARCH_LIMIT = 20;
const MAX_QUERY_LENGTH = 100;

/**
 * Up to twenty active products whose name or SKU contains the query. A blank query lists the first twenty active
 * products (the repository's order), so the card dialog shows a list before anything is typed (D-269).
 */
export async function searchProductsForPicker(deps: ProductSearchDeps, query: string): Promise<ProductPickerHit[]> {
  return deps.catalogue.searchActiveProducts(query.trim().slice(0, MAX_QUERY_LENGTH), PRODUCT_SEARCH_LIMIT);
}

/** The picker's already-selected products, in the order asked. */
export async function productSummariesForPicker(deps: ProductSearchDeps, ids: readonly string[]): Promise<ProductPickerHit[]> {
  return ids.length === 0 ? [] : deps.catalogue.findProductSummaries(ids);
}
