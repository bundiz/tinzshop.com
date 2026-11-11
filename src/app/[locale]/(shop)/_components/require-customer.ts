import { redirect } from 'next/navigation';
import type { CurrentCustomer } from '@/server/services/auth/customer-session-service';
import { readCurrentCustomer } from './read-current-customer';

/** `?a=1&a=2&b=3` for a page's search params, or an empty string. */
export function queryString(searchParams: { [key: string]: string | string[] | undefined }): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(name, item);
  }
  const text = query.toString();
  return text === '' ? '' : `?${text}`;
}

/** The sign-in page for a visitor who must sign in first, returning to `path` (locale-less, with its query). */
export function signInPath(locale: string, path: string): string {
  return `/${locale}/sign-in?returnTo=${encodeURIComponent(path)}`;
}

/**
 * The product pages' gate (O-10, D-041): the signed-in customer, or a redirect to sign-in that returns to this
 * page. Runs on the server, in the page, so a hidden link is not the only protection.
 */
export async function requireCustomer(locale: string, path: string): Promise<CurrentCustomer> {
  const customer = await readCurrentCustomer();
  if (customer === null) redirect(signInPath(locale, path));
  return customer;
}

/** Sign-in and register: a customer who is already signed in goes home. */
export async function redirectSignedInHome(locale: string): Promise<void> {
  if ((await readCurrentCustomer()) !== null) redirect(`/${locale}`);
}
