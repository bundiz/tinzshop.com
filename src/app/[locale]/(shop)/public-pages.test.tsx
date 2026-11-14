import { createTranslator, NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import th from '../../../../messages/th.json';

/**
 * O-10 (plan 014): signed out, the home page with its products and the news pages stay open. Only the two
 * product pages ask for sign-in. Nobody is signed in in this file.
 */

const CARD = vi.hoisted(() => ({
  productId: '7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60',
  name: 'Astro Bot',
  imageUrl: null,
  priceSatang: 129000n,
  originalPriceSatang: null,
  isPriceRange: false,
  stockStatus: 'in_stock',
  isKit: false,
  isPreOrder: false,
  releaseDate: null,
}));

vi.mock('@/server/composition-root', () => ({
  getLandingCatalogueReader: () => async () => ({ bestSellers: [CARD], bundles: [], preOrders: [] }),
  getLatestNewsReader: () => async () => [],
}));
vi.mock('./_components/read-articles-menu', () => ({ readArticlesMenu: async () => [] }));
vi.mock('./_components/read-current-customer', () => ({ readCurrentCustomer: async () => null }));
vi.mock('./news/read-news', () => ({
  readNewsList: async () => ({ items: [], page: 1, activeCategorySlug: null }),
  readNewsArticle: async () => ({ slug: 'x' }),
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async ({ namespace }: { namespace?: string }) =>
    createTranslator({ locale: 'th', messages: th, namespace: namespace as never }),
}));

const { default: HomePage } = await import('./(home)/page');
const { default: NewsPage } = await import('./news/page');
const { default: NewsCategoryPage } = await import('./news/category/[slug]/page');
const { default: NewsArticlePage } = await import('./news/[slug]/page');

describe('signed-out visitors', () => {
  it('news pages stay public', async () => {
    const params = Promise.resolve({ locale: 'th', slug: 'nintendo' });
    const none = Promise.resolve({});
    const pages = [
      await NewsPage({ params, searchParams: none }),
      await NewsCategoryPage({ params, searchParams: none }),
      await NewsArticlePage({ params }),
    ] as ReactElement<{ customer: unknown }>[];
    // Each answered with its page, not a redirect, and drew the signed-out header.
    for (const page of pages) expect(page.props.customer).toBeNull();
  });

  it('the home page stays public and keeps showing its products (D-161)', async () => {
    const page = await HomePage({ params: Promise.resolve({ locale: 'th' }) });
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
        {page}
      </NextIntlClientProvider>,
    );
    // The product is drawn and links to its page; sign-in is asked for there, not here.
    expect(html).toContain('Astro Bot');
    expect(html).toContain(`href="/th/product/${CARD.productId}/detail"`);
    expect(html).toContain('href="/th/sign-in"');
  });

  it('the home page has no pre-order section and no store-visit block', async () => {
    const page = await HomePage({ params: Promise.resolve({ locale: 'th' }) });
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
        {page}
      </NextIntlClientProvider>,
    );
    expect(html).not.toContain('id="preOrders"');
    expect(html).not.toContain('พรีออเดอร์ เปิดจองแล้ว');
    expect(html).not.toContain('แวะมาดูของจริงที่หน้าร้าน');
    expect(html).not.toContain('ดูแผนที่ร้าน');
    // Signed out: the hero offers สมัครสมาชิก; with no kit there is no feature card, and nothing is invented.
    expect(html).toContain(th.shop.home.hero.register);
    expect(html).not.toContain(th.shop.home.hero.feature.tag);
    for (const made of ['Switch 2', 'สัปดาห์นี้', 'ซื้อคู่กันบ่อย', 'ถูกกว่าซื้อแยก', 'เครื่องประกันร้าน', 'เลขพัสดุ', 'รอข้อมูลจากร้าน', 'เบอร์ร้าน']) {
      expect(html).not.toContain(made);
    }
  });
});
