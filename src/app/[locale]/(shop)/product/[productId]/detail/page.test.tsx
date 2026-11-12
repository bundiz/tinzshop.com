import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import th from '../../../../../../../messages/th.json';
import type { ProductDetail } from '@/server/services/catalogue/product-detail-service';

const KNOWN_ID = '7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60';

const DETAIL = {
  productId: KNOWN_ID,
  name: 'Astro Bot',
  platformCategory: null,
  productType: null,
  imageUrls: [],
  optionTypes: [],
  variants: [],
  defaultVariantId: '',
  description: '',
  brandName: null,
  shippingSizeTier: null,
  isKit: false,
  isPreOrder: false,
  releaseDate: null,
} as unknown as ProductDetail;

const card = (n: number) => ({ productId: `card-${n}` });
const catalogue = vi.hoisted(() => ({ bestSellers: [] as { productId: string }[] }));

vi.mock('@/server/composition-root', () => ({
  getProductDetailReader: () => async (productId: string) => (productId === KNOWN_ID ? DETAIL : null),
  getLandingCatalogueReader: () => async () => ({ bestSellers: catalogue.bestSellers, bundles: [], preOrders: [] }),
}));
const session = vi.hoisted(() => ({ customer: { id: 'c1', firstName: 'Test', email: 'test@example.test' } as { id: string; firstName: string; email: string } | null }));
vi.mock('../../../_components/read-current-customer', () => ({ readCurrentCustomer: async () => session.customer }));
vi.mock('../../../_components/read-articles-menu', () => ({ readArticlesMenu: async () => [] }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async () => (key: string, values?: { name?: string }) => `${key}:${values?.name ?? ''}`,
}));

const { default: ProductPage } = await import('./page');
const { generateMetadata } = await import('./layout');

/** The props of the first element in a rendered tree that satisfies `match`. */
function findElement(node: unknown, match: (props: Record<string, unknown>) => boolean): Record<string, unknown> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, match);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof node !== 'object' || node === null || !('props' in node)) return undefined;
  const props = (node as { props: Record<string, unknown> }).props;
  if (match(props)) return props;
  return findElement(props.children, match);
}

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

  it('signed-out product detail redirects with that product as returnTo', async () => {
    session.customer = null;
    try {
      const digest = await ProductPage({ params: Promise.resolve({ locale: 'th', productId: KNOWN_ID }) }).then(
        () => '',
        (error: { digest?: string }) => error.digest ?? '',
      );
      expect(digest.split(';').slice(0, 3)).toEqual([
        'NEXT_REDIRECT',
        'replace',
        `/th/sign-in?returnTo=${encodeURIComponent(`/product/${KNOWN_ID}/detail`)}`,
      ]);
    } finally {
      session.customer = { id: 'c1', firstName: 'Test', email: 'test@example.test' };
    }
  });

  it('related products are 5, titled สินค้าที่เกี่ยวข้อง', async () => {
    catalogue.bestSellers = [card(1), card(2), card(3), card(4), card(5), card(6), card(7), { productId: KNOWN_ID }];
    try {
      const page = await ProductPage({ params: Promise.resolve({ locale: 'th', productId: KNOWN_ID }) });
      const section = findElement(page, (props) => props.id === 'related');
      expect(section).toBeDefined();
      expect((section!.cards as { productId: string }[]).map((c) => c.productId)).toEqual([
        'card-1',
        'card-2',
        'card-3',
        'card-4',
        'card-5',
      ]);
      expect(section!.columns).toBe(5);
      expect(section!.titleKey).toBe('product.related.title');
      expect(th.shop.product.related.title).toBe('สินค้าที่เกี่ยวข้อง');
      expect(section!.moreHref).toBe('/th/product?sort=best_selling');
    } finally {
      catalogue.bestSellers = [];
    }
  });

  it('leaves room under the footer, below sm, for the phone buy bar', async () => {
    const page = await ProductPage({ params: Promise.resolve({ locale: 'th', productId: KNOWN_ID }) });
    const spacer = findElement(page, (props) => props['data-buy-bar-spacer'] === '');
    expect(spacer?.className).toBe('h-[84px] sm:hidden');
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
