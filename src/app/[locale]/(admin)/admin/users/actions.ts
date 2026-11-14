'use server';

import { hasLocale } from 'next-intl';
import { revalidatePath } from 'next/cache';

import { routing } from '@/i18n/routing';
import { getAccountAdmin } from '@/server/composition-root';
import type { AccountAdminState } from '@/server/controllers/access/account-admin-controller';
import { requirePermission } from '../_lib/require-permission';

/** The locale comes from a hidden form field; anything else falls back to the default, Thai. */
function localeOf(formData: FormData): string {
  const value = formData.get('locale');
  return typeof value === 'string' && hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

function refresh(locale: string, state: AccountAdminState): AccountAdminState {
  if (state.status === 'ok') revalidatePath(`/${locale}/admin/users`);
  return state;
}

/** Sets one account's role. Re-checks `account.manage` itself; the page's check does not cover an action. */
export async function changeAccountRoleAction(_previous: AccountAdminState, formData: FormData): Promise<AccountAdminState> {
  const locale = localeOf(formData);
  const actor = await requirePermission(locale, '/admin/users', 'account.manage');
  return refresh(locale, await getAccountAdmin().changeRole(actor, formData));
}

/** Blocks or unblocks one account. Re-checks `account.manage`. */
export async function setAccountBlockedAction(_previous: AccountAdminState, formData: FormData): Promise<AccountAdminState> {
  const locale = localeOf(formData);
  const actor = await requirePermission(locale, '/admin/users', 'account.manage');
  return refresh(locale, await getAccountAdmin().setBlocked(actor, formData));
}

/** Replaces the permissions one role holds. Re-checks `role.manage`. */
export async function saveRolePermissionsAction(_previous: AccountAdminState, formData: FormData): Promise<AccountAdminState> {
  const locale = localeOf(formData);
  const actor = await requirePermission(locale, '/admin/users?tab=roles', 'role.manage');
  return refresh(locale, await getAccountAdmin().saveRolePermissions(actor, formData));
}
