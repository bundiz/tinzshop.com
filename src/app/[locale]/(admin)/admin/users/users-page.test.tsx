import { createTranslator, NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/ui/Toast';
import type { PermissionKey } from '@/server/services/access/permission-keys';
import type { CurrentCustomer } from '@/server/services/auth/customer-session-service';
import en from '../../../../../../messages/en.json';
import th from '../../../../../../messages/th.json';

const request = vi.hoisted(() => ({ customer: null as CurrentCustomer | null }));

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async ({ locale, namespace }: { locale: 'th' | 'en'; namespace?: string }) =>
    createTranslator({ locale, messages: locale === 'th' ? th : en, namespace: namespace as never }),
}));
vi.mock('../../../(shop)/_components/read-current-customer', () => ({ readCurrentCustomer: async () => request.customer }));
vi.mock('@/server/composition-root', () => ({
  getAccountAdmin: () => ({
    searchAccounts: async () => ({ total: 0, rows: [] }),
    listRoleGrants: async () => ({ guest: [], customer: [], blogger: [], sale_manager: [], admin: [], super_admin: [] }),
  }),
}));
vi.mock('./actions', () => ({ changeAccountRoleAction: async () => {}, setAccountBlockedAction: async () => {}, saveRolePermissionsAction: async () => {} }));

const { default: UsersPage } = await import('./page');

function as(permissions: PermissionKey[]): void {
  request.customer = { id: 'c1', firstName: 'T', email: 't@example.com', roleKey: 'super_admin', permissions };
}

async function render(searchParams: Record<string, string> = {}): Promise<string> {
  const node = await UsersPage({ params: Promise.resolve({ locale: 'th' }), searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      {/* AdminShell, in the layout, holds the provider in the app. */}
      <ToastProvider closeLabel="ปิด">{node as ReactNode}</ToastProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  request.customer = null;
});

describe('the users page tabs', () => {
  it('shows both tabs to a holder of both keys', async () => {
    as(['backoffice.enter', 'account.manage', 'role.manage']);
    const out = await render();
    expect(out).toContain('บัญชีทั้งหมด');
    expect(out).toContain('ตำแหน่งและสิทธิ์');
  });

  it('shows only the accounts tab to account.manage alone', async () => {
    as(['backoffice.enter', 'account.manage']);
    const out = await render();
    expect(out).toContain('บัญชีทั้งหมด');
    expect(out).not.toContain('ตำแหน่งและสิทธิ์</a>');
  });

  it('opens on the roles tab, and shows only it, for role.manage alone', async () => {
    as(['backoffice.enter', 'role.manage']);
    const out = await render();
    expect(out).not.toContain('บัญชีทั้งหมด');
    expect(out).toContain(th.admin.roles.hint);
  });
});
