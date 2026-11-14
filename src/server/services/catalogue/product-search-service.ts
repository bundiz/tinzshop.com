/** One product as the news editor's picker shows it (R3). */
export type ProductPickerHit = { id: string; name: string; sku: string; imageUrl: string | null };

export type ProductSearchDeps = {
  catalogue: {
    searchActiveProducts: (query: string, limit: number) => Promise<ProductPickerHit[]>;
    findProductSummaries: (ids: readonly string[]) => Promise<ProductPickerHit[]>;
  };
};

export const PRODUCT_SEARCH_LIMIT = 10;
const MAX_QUERY_LENGTH = 100;

/** Up to ten active products whose name or SKU contains the query; a blank query finds nothing. */
export async function searchProductsForPicker(deps: ProductSearchDeps, query: string): Promise<ProductPickerHit[]> {
  const text = query.trim().slice(0, MAX_QUERY_LENGTH);
  return text === '' ? [] : deps.catalogue.searchActiveProducts(text, PRODUCT_SEARCH_LIMIT);
}

/** The picker's already-selected products, in the order asked. */
export async function productSummariesForPicker(deps: ProductSearchDeps, ids: readonly string[]): Promise<ProductPickerHit[]> {
  return ids.length === 0 ? [] : deps.catalogue.findProductSummaries(ids);
}
