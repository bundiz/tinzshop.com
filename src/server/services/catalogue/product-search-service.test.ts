import { describe, expect, it, vi } from 'vitest';

import { PRODUCT_SEARCH_LIMIT, searchProductsForPicker, type ProductSearchDeps } from './product-search-service';

function setup() {
  const catalogue = {
    searchActiveProducts: vi.fn(async (_query: string, _limit: number) => [{ id: 'p', name: 'Switch', sku: 'NS', imageUrl: null }]),
    findProductSummaries: vi.fn(async (_ids: readonly string[]) => []),
  };
  return { deps: { catalogue } as ProductSearchDeps, catalogue };
}

describe('searchProductsForPicker', () => {
  it('trims the query and asks for at most ten', async () => {
    const { deps, catalogue } = setup();
    expect(await searchProductsForPicker(deps, '  switch ')).toHaveLength(1);
    expect(catalogue.searchActiveProducts).toHaveBeenCalledWith('switch', PRODUCT_SEARCH_LIMIT);
    expect(PRODUCT_SEARCH_LIMIT).toBe(10);
  });

  it('does not query for a blank query, and cuts a very long one', async () => {
    const { deps, catalogue } = setup();
    expect(await searchProductsForPicker(deps, '   ')).toEqual([]);
    expect(catalogue.searchActiveProducts).not.toHaveBeenCalled();
    await searchProductsForPicker(deps, 'x'.repeat(500));
    expect(catalogue.searchActiveProducts.mock.calls[0]![0]).toHaveLength(100);
  });
});
