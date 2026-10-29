import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../../messages/en.json';
import th from '../../../../../messages/th.json';
import { preventSubmit } from './SearchForm';
import SiteHeader from './SiteHeader';

function render(locale: 'th' | 'en', activeNav?: 'home'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      <SiteHeader path="/" activeNav={activeNav} />
    </NextIntlClientProvider>,
  );
}

describe('SiteHeader', () => {
  it('shows a cart count of 0, never a sample figure', () => {
    const html = render('th');
    expect(html).toContain('aria-label="ตะกร้าสินค้า 0 รายการ"');
    expect(html).toMatch(/>0<\/span>/);
    expect(html).toContain('0 รายการ');
    expect(render('en')).toContain('aria-label="Cart, 0 items"');
  });

  it('renders the search form inert: no action and no submit button', () => {
    const html = render('th');
    const form = html.match(/<form[^>]*>[\s\S]*?<\/form>/)?.[0] ?? '';
    expect(form).toContain('role="search"');
    expect(form).not.toContain('action=');
    expect(form).not.toContain('type="submit"');
    expect(form.match(/<button type="button"/g)?.length).toBe(2);
    expect(form).toContain(`placeholder="${th.shop.header.search.placeholder}"`);
  });

  it('keeps the search form from submitting on Enter', () => {
    const event = { preventDefault: vi.fn() };
    preventSubmit(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('marks home as the current nav entry only on the home page, linking it and the logo to the locale root', () => {
    const home = render('th', 'home');
    expect(home).toMatch(/<a aria-current="page"[^>]*href="\/th"|<a[^>]*href="\/th"[^>]*aria-current="page"/);
    expect(render('th')).not.toContain('aria-current="page"');
    expect(home).toContain(th.shop.header.nav.all);
    expect(home).toContain(th.shop.category.bundles);
  });
});
