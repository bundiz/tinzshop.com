import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LandingProductCard, StorefrontCandidate } from '@/server/services/catalogue/landing-catalogue-service';
import type { ProductDetail } from '@/server/services/catalogue/product-detail-service';
import {
  getStorefrontListing,
  type StorefrontCategory,
  type StorefrontListingSearchParams,
} from '@/server/services/catalogue/storefront-listing-service';
import th from '../../../../messages/th.json';

/**
 * Review Focus 5 (plan 013): the landing cards, the listing cards, the product page's related products and its
 * breadcrumb all point at `/{locale}/product/{id}/detail`, and nothing links to the old `/{locale}/products/…`.
 */

const THIS_ID = '7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60';
const OTHER_ID = '0b8e2f0e-1d7c-4f55-9a43-5d1a6a0c2f11';

const card = (productId: string): LandingProductCard => ({
  productId,
  name: `สินค้า ${productId.slice(0, 4)}`,
  imageUrl: null,
  priceSatang: 129000n,
  originalPriceSatang: null,
  isPriceRange: false,
  stockStatus: 'in_stock',
  isKit: false,
  isPreOrder: false,
  releaseDate: null,
});

const TREE: StorefrontCategory[] = [
  { id: 'ps', slug: 'playstation-5', parentId: null, position: 2, names: { th: 'PlayStation 5' } },
  { id: 'ps-game', slug: 'playstation-5-game', parentId: 'ps', position: 2, names: { th: 'แผ่นเกม' } },
];

const ROW: StorefrontCandidate = {
  productId: OTHER_ID,
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

const DETAIL: ProductDetail = {
  productId: THIS_ID,
  name: 'Astro Bot',
  description: 'เกม',
  brandName: null,
  imageUrls: [],
  optionTypes: [],
  variants: [
    { variantId: 'v1', optionValueIds: [], priceSatang: 129000n, originalPriceSatang: null, stockStatus: 'in_stock' },
  ],
  defaultVariantId: 'v1',
  isKit: false,
  isPreOrder: false,
  releaseDate: null,
  shippingSizeTier: null,
  platformCategory: { slug: 'playstation-5', name: 'PlayStation 5' },
  productType: { slug: 'playstation-5-game', name: 'แผ่นเกม' },
};

vi.mock('@/server/composition-root', () => ({
  getLandingCatalogueReader: () => async () => ({
    bestSellers: [card(OTHER_ID), card(THIS_ID)],
    bundles: [{ ...card(OTHER_ID), isKit: true }],
    preOrders: [{ ...card(OTHER_ID), isPreOrder: true }],
  }),
  getLatestNewsReader: () => async () => [],
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
  getProductDetailReader: () => async (productId: string) => (productId === THIS_ID ? DETAIL : null),
}));
vi.mock('./_components/read-articles-menu', () => ({ readArticlesMenu: async () => [] }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async ({ namespace }: { namespace?: string }) =>
    createTranslator({ locale: 'th', messages: th, namespace: namespace as never }),
}));

const { default: HomePage } = await import('./(home)/page');
const { default: ProductListPage } = await import('./product/page');
const { default: ProductPage } = await import('./product/[productId]/detail/page');

function render(node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

const hrefs = (html: string): string[] => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!.replaceAll('&amp;', '&'));
/** The old product route: `/{locale}/products` or anything under it. */
const OLD_ROUTE = /^\/(th|en)\/products(\/|\?|$)/;

describe('product links', () => {
  it('no link targets the old /products route', async () => {
    const landing = render(await HomePage({ params: Promise.resolve({ locale: 'th' }) }));
    const listing = render(
      await ProductListPage({ params: Promise.resolve({ locale: 'th' }), searchParams: Promise.resolve({}) }),
    );
    const product = render(
      await ProductPage({ params: Promise.resolve({ locale: 'th', productId: THIS_ID }) }),
    );

    for (const [page, html] of Object.entries({ landing, listing, product })) {
      const all = hrefs(html);
      expect(all.length, page).toBeGreaterThan(0);
      expect(all.filter((href) => OLD_ROUTE.test(href)), page).toEqual([]);
      expect(all, page).toContain(`/th/product/${OTHER_ID}/detail`);
    }

    // The related section leaves out the product itself; the breadcrumb links its platform and type.
    const related = product.slice(product.indexOf('id="related"'));
    expect(hrefs(related)).not.toContain(`/th/product/${THIS_ID}/detail`);
    expect(hrefs(product)).toEqual(
      expect.arrayContaining([
        '/th/product?category=playstation-5',
        '/th/product?category=playstation-5&type=playstation-5-game',
      ]),
    );
    // The language switch keeps the reader on this product's page.
    expect(hrefs(product)).toContain(`/en/product/${THIS_ID}/detail`);
  });

  it('no source file outside the tests builds an old /products route', () => {
    const root = join(process.cwd(), 'src');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path);
      }
    };
    walk(root);
    // A route string starts `/products` right after a quote, a backtick or a `${…}` (`/news/category/products` does not).
    const offenders = files.filter((path) => /[`'"}]\/products\b/.test(readFileSync(path, 'utf8')));
    expect(offenders.map((path) => relative(root, path))).toEqual([]);
    expect(() => statSync(join(root, 'app/[locale]/(shop)/products'))).toThrow();
  });
});
