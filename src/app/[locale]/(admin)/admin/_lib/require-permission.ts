import { hasLocale } from 'next-intl';
import { notFound, redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { can } from '@/server/services/access/access-service';
import type { PermissionKey } from '@/server/services/access/permission-keys';
import type { CurrentCustomer } from '@/server/services/auth/customer-session-service';
import { requireCustomer } from '../../../(shop)/_components/require-customer';

/** The page that says "no access"; it sits outside the gate (its own route group) so it cannot loop. */
export function noAccessPath(locale: string): string {
  return `/${locale}/admin/no-access`;
}

/**
 * The back office's gate (spec section 7, D-041, D-243): the signed-in account holding `key`, or a redirect.
 * Signed out goes to sign-in and back to `path` (locale-less, with its query); signed in without the key (or without `backoffice.enter`) goes to
 * the no-access page, which never names the page asked for. It runs on the server, in every page and every Server
 * Action under `/admin`; a hidden menu item is never the check, and a page never relies on a parent layout for it.
 */
export async function requirePermission(locale: string, path: string, key: PermissionKey): Promise<CurrentCustomer> {
  if (!hasLocale(routing.locales, locale)) notFound();
  const customer = await requireCustomer(locale, path);
  // Entering the back office is itself a key: a role given only `key` (news.manage, say) must not reach a page or an action.
  if (!can(customer, 'backoffice.enter') || !can(customer, key)) redirect(noAccessPath(locale));
  return customer;
}
