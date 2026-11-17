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
  it('trims the query and asks for at most twenty (D-269)', async () => {
    const { deps, catalogue } = setup();
    expect(await searchProductsForPicker(deps, '  switch ')).toHaveLength(1);
    expect(catalogue.searchActiveProducts).toHaveBeenCalledWith('switch', PRODUCT_SEARCH_LIMIT);
    expect(PRODUCT_SEARCH_LIMIT).toBe(20);
  });

  it('lists the first twenty active products for a blank query, so the card dialog can show a list before typing (D-269), and cuts a very long query', async () => {
    const { deps, catalogue } = setup();
    expect(await searchProductsForPicker(deps, '   ')).toHaveLength(1);
    expect(catalogue.searchActiveProducts).toHaveBeenCalledWith('', PRODUCT_SEARCH_LIMIT);
    catalogue.searchActiveProducts.mockClear();
    await searchProductsForPicker(deps, 'x'.repeat(500));
    expect(catalogue.searchActiveProducts.mock.calls[0]![0]).toHaveLength(100);
  });
});
