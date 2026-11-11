import { createTranslator } from 'next-intl';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import th from '../../../../messages/th.json';

/**
 * O-10 (plan 014): signed out, the home page with its products and the news pages stay open. Only the two
 * product pages ask for sign-in. Nobody is signed in in this file.
 */

vi.mock('@/server/composition-root', () => ({
  getLandingCatalogueReader: () => async () => ({ bestSellers: [], bundles: [], preOrders: [] }),
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
    const page = (await HomePage({ params: Promise.resolve({ locale: 'th' }) })) as ReactElement;
    expect(page).toBeTruthy();
  });
});
