import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requirePermission } from '../../../../(admin)/admin/_lib/require-permission';
import { isPreviewSession } from '../../../../(admin)/admin/news/_lib/preview-channel';
import LivePreview from './_components/LivePreview';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session?: string | string[] }>;
};

export async function generateMetadata(_props: Props): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/**
 * `/{locale}/admin/news/preview?session={uuid}`: the editor's unsaved draft as a reader will see it, updated as staff type
 * (D-253). The editor opens it in a named tab and sends the draft over a `BroadcastChannel` named by the session; nothing is
 * saved. It sits in the route group `(admin-preview)`, so the page is the article alone, without the back-office frame.
 * Needs `news.manage`; never indexed. Without a valid session it says to open it from the editor.
 */
export default async function NewsPreviewPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session } = await searchParams;
  const valid = isPreviewSession(session);
  // After sign-in the visitor returns to this same session, which the editor tab still holds.
  await requirePermission(locale, valid ? `/admin/news/preview?session=${session}` : '/admin/news/preview', 'news.manage');

  if (!valid) {
    const t = await getTranslations({ locale, namespace: 'admin.news.preview' });
    return (
      <main id="main" className="wrap py-10">
        <p className="text-ink-2">{t('noSession')}</p>
        <a href={`/${locale}/admin/news`} className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand-dark hover:underline">
          {t('backToNews')}
        </a>
      </main>
    );
  }
  return <LivePreview locale={locale} session={session} />;
}
