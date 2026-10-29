import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { ProductDetail } from '@/server/services/catalogue/product-detail-service';

const KNOWN_ID = '7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60';

const DETAIL = { productId: KNOWN_ID, name: 'Astro Bot' } as ProductDetail;

vi.mock('@/server/composition-root', () => ({
  getProductDetailReader: () => async (productId: string) => (productId === KNOWN_ID ? DETAIL : null),
  getLandingCatalogueReader: () => async () => ({ bestSellers: [], bundles: [], preOrders: [] }),
}));
vi.mock('../../../_components/read-articles-menu', () => ({ readArticlesMenu: async () => [] }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async () => (key: string, values?: { name?: string }) => `${key}:${values?.name ?? ''}`,
}));

const { default: ProductPage } = await import('./page');
const { generateMetadata } = await import('./layout');

/** What the page answers: 200 with an element, or 404 from `notFound()`; any other error fails the test. */
async function visit(productId: string, locale = 'th'): Promise<200 | 404> {
  try {
    await ProductPage({ params: Promise.resolve({ locale, productId }) });
    return 200;
  } catch (error) {
    if ((error as { digest?: string }).digest?.includes('404')) return 404;
    throw error;
  }
}

describe('the product page at /product/{id}/detail', () => {
  it('answers a real 404 for an unknown, malformed or hidden id, and for an unknown locale', async () => {
    expect(await visit(KNOWN_ID)).toBe(200);
    expect(await visit('00000000-0000-4000-8000-000000000000')).toBe(404);
    expect(await visit('not-a-uuid')).toBe(404);
    expect(await visit(KNOWN_ID, 'fr')).toBe(404);
  });

  it('titles a missing product as not found from the layout', async () => {
    const meta = (productId: string) =>
      generateMetadata({ params: Promise.resolve({ locale: 'th', productId }) });
    expect(await meta(KNOWN_ID)).toEqual({ title: 'meta.title:Astro Bot' });
    expect(await meta('not-a-uuid')).toEqual({ title: 'meta.title:notFound.title:' });
  });

  it('has no page at /product/{id} and no loading boundary above it (D-120)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const productIdDir = dirname(here);
    // `/product/{id}` alone matches no page, so the locale catch-all answers it with a 404 (D-122).
    expect(readdirSync(productIdDir)).toEqual(['detail']);
    for (const dir of [here, productIdDir, dirname(productIdDir), join(productIdDir, '../..')]) {
      expect(existsSync(join(dir, 'loading.tsx')), dir).toBe(false);
    }
  });
});
