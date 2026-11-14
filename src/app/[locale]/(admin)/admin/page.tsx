import { getTranslations, setRequestLocale } from 'next-intl/server';
import { can } from '@/server/services/access/access-service';
import { requirePermission } from './_lib/require-permission';

type Props = { params: Promise<{ locale: string }> };

/**
 * `/{locale}/admin` (plan 016): the greeting, and, for an account whose menu has nothing beyond this page (a Sale-manager
 * in stage 1), a line that more tools come later. It needs `backoffice.enter`, checked here and not left to the layout.
 */
export default async function AdminHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const customer = await requirePermission(locale, '/admin', 'backoffice.enter');
  const t = await getTranslations({ locale, namespace: 'admin.home' });
  const hasMore = can(customer, 'news.manage') || can(customer, 'account.manage');
  return (
    <>
      <h1 className="font-head text-[24px] font-bold text-ink md:text-[28px]">{t('greeting', { name: customer.firstName })}</h1>
      {hasMore ? null : <p className="mt-1 text-muted">{t('moreLater')}</p>}
    </>
  );
}
