import { NextIntlClientProvider, createTranslator } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../messages/en.json';
import th from '../../../../../messages/th.json';
import PageNotFound from './not-found';

const request = vi.hoisted(() => ({ locale: 'th' as 'th' | 'en' }));

// The not-found page is an async Server Component: the request's translations and menu are stood in for.
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: request.locale, messages: request.locale === 'th' ? th : en, namespace: namespace as never }),
}));
vi.mock('../_components/read-articles-menu', () => ({
  readRequestArticlesMenu: async () => [{ labelKey: 'news', href: `/${request.locale}/news`, children: [] }],
}));

async function render(locale: 'th' | 'en'): Promise<string> {
  request.locale = locale;
  const page: ReactNode = await PageNotFound();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      {page}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  request.locale = 'th';
});

describe('PageNotFound', () => {
  it('says the page is missing in the locale, inside the site header and footer, with a way home', async () => {
    const html = await render('th');
    expect(html).toContain(th.shop.notFound.title);
    expect(html).toContain(th.shop.notFound.text);
    expect(html).toContain(`href="/th"`);
    expect(html).toContain('<header');
    expect(html).toContain('<footer');
    expect(html).toContain(th.shop.header.articles.label);

    const english = await render('en');
    expect(english).toContain(en.shop.notFound.title);
    expect(english).toContain(`href="/en"`);
  });
});
