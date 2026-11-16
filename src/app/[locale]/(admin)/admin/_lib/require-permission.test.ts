import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentCustomer } from '@/server/services/auth/customer-session-service';
import type { PermissionKey, RoleKey } from '@/server/services/access/permission-keys';

const request = vi.hoisted(() => ({ customer: null as CurrentCustomer | null }));
vi.mock('../../../(shop)/_components/read-current-customer', () => ({ readCurrentCustomer: async () => request.customer }));

const { requirePermission } = await import('./require-permission');

function account(roleKey: RoleKey, permissions: PermissionKey[]): CurrentCustomer {
  return { id: 'c1', firstName: 'Tester', email: 'tester@example.com', roleKey, permissions };
}

/** The target of the redirect a call throws (`NEXT_REDIRECT;replace;{url};307;`), or null when it returns. */
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

describe('requirePermission', () => {
  beforeEach(() => {
    request.customer = null;
  });

  it('sends a signed-out visitor to sign-in, returning to the page asked for', async () => {
    expect(await redirectOf(() => requirePermission('th', '/admin/news', 'news.manage'))).toBe(
      '/th/sign-in?returnTo=%2Fadmin%2Fnews',
    );
  });

  it('refuses a Customer (no back-office key) with the no-access page', async () => {
    request.customer = account('customer', []);
    expect(await redirectOf(() => requirePermission('en', '/admin', 'backoffice.enter'))).toBe('/en/admin/no-access');
  });

  it('refuses a Blogger a key the role does not hold', async () => {
    request.customer = account('blogger', ['backoffice.enter', 'news.manage']);
    expect(await redirectOf(() => requirePermission('th', '/admin/users', 'account.manage'))).toBe('/th/admin/no-access');
  });

  it('passes a Blogger for backoffice.enter and returns the customer', async () => {
    const blogger = account('blogger', ['backoffice.enter', 'news.manage']);
    request.customer = blogger;
    await expect(requirePermission('th', '/admin', 'backoffice.enter')).resolves.toBe(blogger);
  });

  it('refuses a role holding the key but not backoffice.enter, for any key', async () => {
    request.customer = account('blogger', ['news.manage']);
    expect(await redirectOf(() => requirePermission('en', '/admin/news', 'news.manage'))).toBe('/en/admin/no-access');
  });
});
