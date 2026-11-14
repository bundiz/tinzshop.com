import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { readCurrentCustomer } from '../../(shop)/_components/read-current-customer';
import { can } from '@/server/services/access/access-service';
import { noAccessPath } from './_lib/require-permission';
import AdminShell from './_components/AdminShell';

// Staff pages depend on the session cookie and are never indexed.
export const dynamic = 'force-dynamic';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.meta' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * The back office's frame: the side menu and top bar around every page under `/admin`, for an account that holds
 * `backoffice.enter`. A signed-in account without it is sent to the no-access page (defence in depth). A signed-out visitor falls through to the
 * page, whose own `requirePermission` sends them to sign-in and back: the layout does not know which page was asked for, and
 * it does not re-run on a client-side move between pages, so it is never the check (D-041, D-243); a guard test requires
 * every page to call `requirePermission`. The no-access
 * page lives in the sibling `(admin-open)` group, outside this layout.
 */
export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const customer = await readCurrentCustomer();
  // Signed out falls through to the page, whose requirePermission sends them to sign-in with the right returnTo.
  if (customer === null) return <>{children}</>;
  // Signed in without the key: refused here too, so a page that forgot its own check still shows non-staff nothing.
  if (!can(customer, 'backoffice.enter')) redirect(noAccessPath(locale));
  const t = await getTranslations({ locale, namespace: 'admin.role' });
  return (
    <AdminShell locale={locale} permissions={customer.permissions} name={customer.firstName} roleLabel={t(customer.roleKey)}>
      {children}
    </AdminShell>
  );
}
