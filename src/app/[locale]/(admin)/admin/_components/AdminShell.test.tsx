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

describe('the back-office language', () => {
  it('has no TH/EN switch: the back office is Thai only', () => {
    expect(render('th')).not.toContain(`aria-label="${th.admin.language.label}"`);
  });
});

describe('the back-office top row', () => {
  it('has no header bar: an editor page opens with its trail, before the page itself', () => {
    pathname = '/th/admin/news/new';
    const markup = render('th');
    pathname = '/th/admin/news';
    expect(markup).not.toContain('<header');
    const row = markup.slice(markup.indexOf('<main'));
    const crumbs = row.indexOf('aria-label="เส้นทาง"');
    expect(crumbs).toBeGreaterThan(-1);
    expect(row).toMatch(/<a[^>]*href="\/th\/admin\/news"[^>]*>ข่าวทั้งหมด<\/a>/);
    expect(row).toContain('>เขียนข่าวใหม่</span>');
    expect(row.indexOf('<p>child</p>')).toBeGreaterThan(crumbs);
  });

  it('shows no trail on a section page, and keeps only the phone menu button there', () => {
    const row = render('th').slice(0);
    expect(row).not.toContain('aria-label="เส้นทาง"');
    expect(row).toMatch(/<div class="[^"]*md:hidden[^"]*"><button[^>]*aria-controls="admin-side-nav"/);
  });
});

describe('the back-office toast (D-262)', () => {
  it('holds the one ToastProvider: a single polite live region, empty until a save', () => {
    const markup = render('th');
    expect(markup.match(/role="status"/g)).toHaveLength(1);
    expect(markup).toContain('<div role="status" aria-live="polite" class="sr-only"></div>');
  });
});
