import { createTranslator, NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey, RoleKey } from '@/server/services/access/permission-keys';
import type { CurrentCustomer } from '@/server/services/auth/customer-session-service';
import en from '../../../../../messages/en.json';
import th from '../../../../../messages/th.json';

const request = vi.hoisted(() => ({ customer: null as CurrentCustomer | null }));

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async ({ locale, namespace }: { locale: 'th' | 'en'; namespace?: string }) =>
    createTranslator({ locale, messages: locale === 'th' ? th : en, namespace: namespace as never }),
}));
vi.mock('../../(shop)/_components/read-current-customer', () => ({ readCurrentCustomer: async () => request.customer }));
vi.mock('../../(shop)/(auth)/actions', () => ({ signOutAction: async () => {} }));
vi.mock('next/navigation', async (original) => ({ ...(await original<object>()), usePathname: () => '/th/admin' }));

const { default: AdminHomePage } = await import('./page');
const { default: NoAccessPage } = await import('../../(admin-open)/admin/no-access/page');
const { default: AdminLayout } = await import('./layout');

const params = (locale: string) => Promise.resolve({ locale });

function account(roleKey: RoleKey, permissions: PermissionKey[]): CurrentCustomer {
  return { id: 'c1', firstName: 'Tester', email: 'tester@example.com', roleKey, permissions };
}

function html(node: ReactNode, locale: 'th' | 'en' = 'th'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

async function redirectOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? '';
    if (!digest.startsWith('NEXT_REDIRECT')) throw error;
    return digest.split(';')[2] ?? null;
  }
}

beforeEach(() => {
  request.customer = null;
});

describe('the back-office home page', () => {
  it('redirects a signed-out visitor to sign-in, returning to /admin', async () => {
    expect(await redirectOf(() => AdminHomePage({ params: params('th') }))).toBe('/th/sign-in?returnTo=%2Fadmin');
  });

  it('refuses a Customer', async () => {
    request.customer = account('customer', []);
    expect(await redirectOf(() => AdminHomePage({ params: params('th') }))).toBe('/th/admin/no-access');
  });

  it('greets a Blogger by name, with no "more later" line because the menu has news', async () => {
    request.customer = account('blogger', ['backoffice.enter', 'news.manage']);
    const markup = html(await AdminHomePage({ params: params('th') }));
    expect(markup).toContain('สวัสดี คุณTester');
    expect(markup).not.toContain('เครื่องมือเพิ่มเติมจะมาในรอบถัดไป');
  });

  it('tells a Sale-manager, whose menu is only the dashboard, that more tools come later', async () => {
    request.customer = account('sale_manager', ['backoffice.enter']);
    expect(html(await AdminHomePage({ params: params('th') }))).toContain('เครื่องมือเพิ่มเติมจะมาในรอบถัดไป');
    expect(html(await AdminHomePage({ params: params('en') }), 'en')).toContain('More tools arrive in later stages');
  });
});

describe('the no-access page', () => {
  it('says so in Thai and English with a link home, and names no page', async () => {
    const thMarkup = html(await NoAccessPage({ params: params('th') }));
    expect(thMarkup).toContain('คุณไม่มีสิทธิ์เข้าหน้านี้');
    expect(thMarkup).toContain('href="/th"');
    const enMarkup = html(await NoAccessPage({ params: params('en') }), 'en');
    expect(enMarkup).toContain('You do not have access to this page');
    expect(enMarkup).toContain('href="/en"');
  });
});

describe('the back-office layout', () => {
  it('draws the shell with the menu for an account that may enter', async () => {
    request.customer = account('blogger', ['backoffice.enter', 'news.manage']);
    const markup = html(await AdminLayout({ children: <p>child</p>, params: params('th') }));
    expect(markup).toContain('child');
    expect(markup).toContain('ข่าวและบทความ');
    expect(markup).toContain('Blogger');
  });

  it('draws no menu for anyone else: the page itself sends them away', async () => {
    request.customer = account('customer', []);
    const markup = html(await AdminLayout({ children: <p>child</p>, params: params('th') }));
    expect(markup).toContain('child');
    expect(markup).not.toContain('แดชบอร์ด');
    request.customer = null;
    expect(html(await AdminLayout({ children: <p>child</p>, params: params('th') }))).not.toContain('แดชบอร์ด');
  });
});
