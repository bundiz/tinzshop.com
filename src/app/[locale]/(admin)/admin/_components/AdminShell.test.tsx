import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import en from '../../../../../../messages/en.json';
import th from '../../../../../../messages/th.json';

vi.mock('../../../(shop)/(auth)/actions', () => ({ signOutAction: async () => {} }));
vi.mock('next/navigation', async (original) => ({
  ...(await original<object>()),
  usePathname: () => '/th/admin/news',
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
