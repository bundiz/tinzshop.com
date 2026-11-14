import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { readCurrentCustomer } from '../../(shop)/_components/read-current-customer';
import { can } from '@/server/services/access/access-service';
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
 * `backoffice.enter`. For anyone else it draws no frame, and the page's own `requirePermission` sends them away. The
 * layout cannot do that itself: it does not know which page was asked for, so sign-in could not return to it, and a
 * layout does not re-run on a client-side move between pages, so it is never the check (D-041, D-243). The no-access
 * page lives in the sibling `(admin-open)` group, outside this layout.
 */
export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const customer = await readCurrentCustomer();
  if (customer === null || !can(customer, 'backoffice.enter')) return <>{children}</>;
  const t = await getTranslations({ locale, namespace: 'admin.role' });
  return (
    <AdminShell locale={locale} permissions={customer.permissions} name={customer.firstName} roleLabel={t(customer.roleKey)}>
      {children}
    </AdminShell>
  );
}
