import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import NoAccess from '../../../(admin)/admin/_components/NoAccess';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.noAccess' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * `/{locale}/admin/no-access`: where `requirePermission` sends a signed-in account without the key. It is in its own route
 * group, beside `(admin)`, so the back-office layout does not wrap it and it does not itself need `backoffice.enter`
 * (which would loop). It says the same to everyone and names no page.
 */
export default async function NoAccessPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NoAccess locale={locale} />;
}
