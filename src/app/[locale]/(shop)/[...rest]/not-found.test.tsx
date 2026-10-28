import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../../../messages/en.json';
import th from '../../../../../messages/th.json';
import PageNotFound from './not-found';

function render(locale: 'th' | 'en'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      <PageNotFound />
    </NextIntlClientProvider>,
  );
}

describe('PageNotFound', () => {
  it('says the page is missing in the locale, inside the site header and footer, with a way home', () => {
    const html = render('th');
    expect(html).toContain(th.shop.notFound.title);
    expect(html).toContain(th.shop.notFound.text);
    expect(html).toContain(`href="/th"`);
    expect(html).toContain('<header');
    expect(html).toContain('<footer');

    const english = render('en');
    expect(english).toContain(en.shop.notFound.title);
    expect(english).toContain(`href="/en"`);
  });
});
