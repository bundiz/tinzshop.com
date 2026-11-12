import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../../messages/en.json';
import th from '../../../../../messages/th.json';
import { preventSubmit } from './SearchForm';
import type { ArticlesMenuEntry } from './articles-menu';
import SiteHeader, { type SiteNavKey } from './SiteHeader';

// The sign-out Server Action pulls in the whole server graph; a render test only needs it to exist.
vi.mock('../(auth)/actions', () => ({ signOutAction: async () => {} }));

const MENU: ArticlesMenuEntry[] = [
  { labelKey: 'reviews', href: '/th/news/category/reviews', children: [] },
  { labelKey: 'products', href: '/th/news/category/products', children: [] },
  {
    labelKey: 'news',
    href: '/th/news',
    children: [{ name: 'NINTENDO', href: '/th/news/category/nintendo' }],
  },
];

function render(
  locale: 'th' | 'en',
  activeNav?: SiteNavKey,
  articlesMenu: ArticlesMenuEntry[] = MENU,
  customer?: { firstName: string } | null,
): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      <SiteHeader path="/" activeNav={activeNav} articlesMenu={articlesMenu} customer={customer} />
    </NextIntlClientProvider>,
  );
}

/** The top dark utility bar, up to the sticky header. */
const utilityBar = (html: string): string => html.slice(0, html.indexOf('<header'));

/** The category nav, inside the header. */
const categoryNav = (html: string): string => {
  const start = html.indexOf(`<nav aria-label="${th.shop.header.nav.label}"`);
  return html.slice(start, html.indexOf('</nav>', start));
};

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
    expect(form.match(/<button type="button"/g)?.length).toBe(1);
    expect(form).toContain(`placeholder="${th.shop.header.search.placeholder}"`);
  });

  it('the search button is type=button and the form has no action', () => {
    const form = render('th').match(/<form[^>]*>[\s\S]*?<\/form>/)?.[0] ?? '';
    expect(form).toMatch(new RegExp(`<button type="button"[^>]*>${th.shop.header.search.submit}</button>`));
    expect(form).not.toMatch(/<form[^>]*\saction=/);
    expect(form).not.toContain('method=');
  });

  it('sets the top bar message at 13px below sm, so "ส่งทั่วประเทศไทย" stays on one line at 360px (style.css L627)', () => {
    expect(utilityBar(render('th'))).toMatch(/<p class="[^"]*\btext-\[13px\] sm:text-sm\b[^"]*">/);
  });

  it('keeps the logo link at least 44px tall below sm', () => {
    expect(render('th')).toMatch(/<a aria-label="Tinzshop หน้าแรก" class="flex min-h-11 [^"]*" href="\/th">/);
  });

  it('the skip link is the first link and targets #main', () => {
    const html = render('th');
    expect(html.match(/<a [^>]*>/)?.[0]).toContain('href="#main"');
    expect(html.slice(0, html.indexOf('</a>'))).toContain(th.shop.header.skip);
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
    expect(home).toContain(th.shop.category.bundles);
    expect(home).not.toContain('หมวดหมู่ทั้งหมด');
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
    const nav = categoryNav(html);
    expect(nav).toContain('href="/th/news"');
    expect(nav).toContain(`>${th.shop.category.news}</a>`);
  });

  it('the nav lists the mockup\'s entries, links the product ones to the listing, and leaves เครื่องเกมอื่น ๆ · ของเล่น and สินค้าลดราคา inert', () => {
    const nav = categoryNav(render('th')).replace(/&amp;/g, '&');
    expect(nav).not.toContain('หมวดหมู่ทั้งหมด');
    const labels = [...nav.matchAll(/<a [^>]*>(?:<span[^>]*><\/span>)?([^<]+)<\/a>/g)].map((match) => match[1]);
    expect(labels).toEqual([
      th.shop.header.nav.home,
      th.shop.category.ps5,
      th.shop.category.switch,
      th.shop.category.gadgets,
      th.shop.category.preOrder,
      th.shop.category.bundles,
      th.shop.category.otherToys,
      th.shop.category.sale,
      th.shop.category.news,
    ]);
    expect(nav).toMatch(new RegExp(`href="/th/product\\?category=nintendo-switch"[^>]*>(<span[^>]*></span>)?${th.shop.category.switch}<`));
    expect(nav).toMatch(new RegExp(`href="/th/product\\?category=playstation-5"[^>]*>(<span[^>]*></span>)?${th.shop.category.ps5}<`));
    expect(nav).toMatch(new RegExp(`href="/th/product\\?category=it-gadgets"[^>]*>(<span[^>]*></span>)?${th.shop.category.gadgets}<`));
    expect(nav).toMatch(new RegExp(`href="/th/product\\?pre_order=1"[^>]*>${th.shop.category.preOrder}<`));
    expect(nav).toMatch(new RegExp(`href="/th/product\\?kit=1"[^>]*>${th.shop.category.bundles}<`));
    expect(nav).toMatch(new RegExp(`href="#"[^>]*>(<span[^>]*></span>)?${th.shop.category.otherToys}<`));
    expect(nav).toMatch(new RegExp(`text-sale[^>]*href="#"[^>]*>${th.shop.category.sale}<`));
    expect(nav.match(/href="#"/g)?.length).toBe(2);
    // The platform dots: ps, ns, it and other.
    for (const dot of ['bg-ps', 'bg-ns', 'bg-it', 'bg-other']) expect(nav).toContain(dot);
  });

  it('never marks เครื่องเกมอื่น ๆ · ของเล่น or สินค้าลดราคา as current', () => {
    const nav = categoryNav(render('th', 'sale'));
    expect(nav).not.toContain('aria-current');
    expect(categoryNav(render('th', 'otherToys'))).not.toContain('aria-current');
    expect(categoryNav(render('th', 'ps5'))).toMatch(/aria-current="page"[^>]*>(<span[^>]*><\/span>)?PlayStation 5/);
  });

  it('names the Nintendo platform from shop.category.switch, never "Switch 2"', () => {
    const html = render('th');
    expect(categoryNav(html)).toContain(th.shop.category.switch);
    expect(html).not.toContain('Switch 2');
    expect(render('en')).not.toContain('Switch 2');
  });

  it('the menu button controls the drawer with aria-expanded', () => {
    const html = render('th');
    const button = html.match(/<button[^>]*aria-controls="[^"]+"[^>]*aria-label="เปิดเมนู"[^>]*>/)?.[0] ?? html.match(/<button[^>]*aria-label="เปิดเมนู"[^>]*>/)?.[0] ?? '';
    expect(button).toContain('aria-expanded="false"');
    expect(button).toMatch(/aria-controls="[^"]+"/);
    expect(button).toContain('md:hidden');
  });

  it("the top bar's LINE link is inert and shows no handle", () => {
    const links = utilityBar(render('th')).match(/<nav aria-label="ลิงก์ช่วยเหลือ"[\s\S]*?<\/nav>/)?.[0] ?? '';
    expect(links).toMatch(new RegExp(`<a href="#"[^>]*>(<svg[\\s\\S]*?</svg>)?${th.shop.header.links.line}</a>`));
    expect(links).not.toMatch(/@[a-z0-9_]/i);
    expect(links).toContain(th.shop.header.links.myOrders);
    expect(links).toContain(th.shop.header.links.warranty);
    expect(links).toContain('hidden md:block');
  });

  it('the top bar keeps the articles menu and the language switch outside the links hidden below md', () => {
    const bar = utilityBar(render('th'));
    const helpLinks = bar.match(/<nav aria-label="ลิงก์ช่วยเหลือ"[\s\S]*?<\/nav>/)?.[0] ?? '';
    expect(helpLinks).toContain('hidden md:block');
    expect(helpLinks).not.toContain(th.shop.header.articles.label);
    expect(helpLinks).not.toContain('hrefLang');
    expect(helpLinks).not.toContain('aria-current');
    expect(bar).toContain(th.shop.header.articles.label);
    expect(bar).toMatch(/<nav aria-label="ภาษา" class="flex /);
    expect(bar).toContain('aria-current="true"');
    expect(bar).toContain('hrefLang="en"');
  });

  it('shows only the bold part of the message on a phone, and the rest from sm', () => {
    const bar = utilityBar(render('th'));
    expect(bar).toContain('<b class="font-semibold text-white">ส่งทั่วประเทศไทย</b>');
    expect(bar).toMatch(/<span class="hidden sm:inline">ค่าส่งตามขนาดสินค้า · สินค้าชิ้นใหญ่ส่งฟรี<\/span>/);
  });

  it('renders no menu when it has no item', () => {
    expect(utilityBar(render('th', undefined, []))).not.toContain(th.shop.header.articles.label);
  });

  describe('the account entry (plan 014)', () => {
    const accountBar = (html: string): string => {
      const start = html.indexOf(`<nav aria-label="${th.shop.header.actions.label}"`);
      const enStart = html.indexOf(`<nav aria-label="${en.shop.header.actions.label}"`);
      const from = start >= 0 ? start : enStart;
      return from < 0 ? '' : html.slice(from, html.indexOf('</nav>', from));
    };

    it('links to sign-in when signed out', () => {
      const html = accountBar(render('th'));
      expect(html).toMatch(/<a[^>]*href="\/th\/sign-in"/);
      expect(html).toContain(th.shop.header.actions.account.line1);
      expect(html).not.toContain(th.shop.auth.menu.signOut);
      expect(accountBar(render('en'))).toMatch(/href="\/en\/sign-in"/);
      expect(accountBar(render('th', undefined, MENU, null))).toMatch(/href="\/th\/sign-in"/);
    });

    it('shows the first name and the "ออกจากระบบ" form when signed in', () => {
      const html = accountBar(render('th', undefined, MENU, { firstName: 'Tester' }));
      expect(html).toContain('Tester');
      expect(html).toContain('ออกจากระบบ');
      expect(html).toMatch(/<form[^>]*>[\s\S]*<input type="hidden" name="locale" value="th"\/>[\s\S]*ออกจากระบบ[\s\S]*<\/form>/);
      expect(html).not.toContain('/sign-in');
      // The menu starts closed, and its button names what it opens.
      expect(html).toContain('aria-expanded="false"');
      expect(html).toMatch(/aria-controls="[^"]+"/);
      expect(html).toMatch(/<div id="[^"]+" hidden=""/);
      expect(html).toContain('aria-label="บัญชีของ Tester"');
      expect(accountBar(render('en', undefined, MENU, { firstName: 'Tester' }))).toContain('Sign out');
    });
  });
});
