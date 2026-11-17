import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-class';

/**
 * What an account without the permission sees (spec section 7). Plain: it says so and links home, and never names the
 * page that was asked for, so it reveals nothing about which pages exist.
 */
export default function NoAccess({ locale }: { locale: string }) {
  const t = useTranslations('admin.noAccess');
  return (
    <main id="main" className="grid min-h-screen place-items-center bg-page px-4">
      <section className="w-full max-w-[480px] rounded-lg border border-line bg-surface p-8 text-center shadow-1">
        <h1 className="font-head text-2xl font-bold text-ink">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('text')}</p>
        <Link href={`/${locale}`} className={`${buttonClass({ variant: 'brand', size: 'admin' })} mt-6`}>
          {t('home')}
        </Link>
      </section>
    </main>
  );
}
