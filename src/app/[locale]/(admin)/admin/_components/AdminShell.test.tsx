import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import en from '../../../../../../messages/en.json';
import th from '../../../../../../messages/th.json';

vi.mock('../../../(shop)/(auth)/actions', () => ({ signOutAction: async () => {} }));
let pathname = '/th/admin/news';
vi.mock('next/navigation', async (original) => ({
  ...(await original<object>()),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams('status=draft&q=%E0%B9%80%E0%B8%81%E0%B8%A1&page=2'),
}));

const { default: AdminShell } = await import('./AdminShell');

function render(locale: 'th' | 'en'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      <AdminShell locale="th" permissions={['backoffice.enter', 'news.manage']} name="Nok" roleLabel="Blogger">
        <p>child</p>
      </AdminShell>
    </NextIntlClientProvider>,
    {},
  );
}

describe('the back-office language switch', () => {
  it('links to the same page in the other locale and keeps the query string', () => {
    const markup = render('th');
    expect(markup).toContain('href="/en/admin/news?status=draft&amp;q=%E0%B9%80%E0%B8%81%E0%B8%A1&amp;page=2"');
  });
});

describe('the back-office top row', () => {
  it('has no header bar of its own: the breadcrumb and the language switch share one row at the top of the page', () => {
    pathname = '/th/admin/news/new';
    const markup = render('th');
    pathname = '/th/admin/news';
    expect(markup).not.toContain('<header');
    const row = markup.slice(markup.indexOf('<main'));
    const crumbs = row.indexOf('aria-label="เส้นทาง"');
    const languages = row.indexOf(`aria-label="${th.admin.language.label}"`);
    expect(crumbs).toBeGreaterThan(-1);
    expect(languages).toBeGreaterThan(crumbs);
    expect(row).toMatch(/<a[^>]*href="\/th\/admin\/news"[^>]*>ข่าวทั้งหมด<\/a>/);
    expect(row).toContain('>เขียนข่าวใหม่</span>');
    expect(row.indexOf('<p>child</p>')).toBeGreaterThan(languages);
  });
});
