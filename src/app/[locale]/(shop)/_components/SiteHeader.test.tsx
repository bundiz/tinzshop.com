import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../../messages/en.json';
import th from '../../../../../messages/th.json';
import { preventSubmit } from './SearchForm';
import type { ArticlesMenuEntry } from './articles-menu';
import SiteHeader from './SiteHeader';

const MENU: ArticlesMenuEntry[] = [
  { labelKey: 'reviews', href: '/th/news/category/reviews', children: [] },
  { labelKey: 'products', href: '/th/news/category/products', children: [] },
  {
    labelKey: 'news',
    href: '/th/news',
    children: [{ name: 'NINTENDO', href: '/th/news/category/nintendo' }],
  },
];

function render(locale: 'th' | 'en', activeNav?: 'home', articlesMenu: ArticlesMenuEntry[] = MENU): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      <SiteHeader path="/" activeNav={activeNav} articlesMenu={articlesMenu} />
    </NextIntlClientProvider>,
  );
}

/** The top dark utility bar, up to the sticky header. */
const utilityBar = (html: string): string => html.slice(0, html.indexOf('<header'));

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

  it('replaces the utility bar\'s "ข่าวเกม" link with the "บทความ" menu, labelled from messages (D-140)', () => {
    const bar = utilityBar(render('th'));
    expect(bar).not.toContain('ข่าวเกม');
    expect(bar).toContain(th.shop.header.articles.label);
    expect(bar).toContain(`>${th.shop.header.articles.reviews}</a>`);
    expect(bar).toContain(`>${th.shop.header.articles.products}</a>`);
    expect(bar).toContain(`>${th.shop.header.articles.news}</a>`);
    expect(bar).toContain('>NINTENDO</a>');
    expect(bar).toContain('aria-expanded="false"');
    expect(utilityBar(render('en'))).toContain(en.shop.header.articles.label);
  });

  it('keeps "ข่าวเกม" in the category nav', () => {
    const html = render('th');
    const nav = html.slice(html.indexOf('</header>'));
    expect(nav).toContain('href="/th/news"');
    expect(nav).toContain(`>${th.shop.category.news}</a>`);
  });

  it('shows the menu outside the help links, so it is there at phone width', () => {
    const bar = utilityBar(render('th'));
    const helpLinks = bar.match(/<nav aria-label="ลิงก์ช่วยเหลือ"[\s\S]*?<\/nav>/)?.[0] ?? '';
    expect(helpLinks).not.toContain(th.shop.header.articles.label);
  });

  it('renders no menu when it has no item', () => {
    expect(utilityBar(render('th', undefined, []))).not.toContain(th.shop.header.articles.label);
  });
});
