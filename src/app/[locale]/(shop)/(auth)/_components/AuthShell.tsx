import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import type { ArticlesMenuEntry } from '../../_components/articles-menu';
import SiteFooter from '../../_components/SiteFooter';
import SiteHeader, { type HeaderCustomer } from '../../_components/SiteHeader';
import AuthPerks from './AuthPerks';

/**
 * The site header and footer around an auth card, with the real customer in the header (sign-in and register send
 * a signed-in customer home, but verify and reset do not, so they show the name). Under the header: the breadcrumb,
 * then the card, with the perks panel beside it from `lg` on sign-in and register (plan 015 Task 8, D-220).
 */
export default function AuthShell({
  path,
  articlesMenu,
  customer = null,
  breadcrumb,
  perks,
  children,
}: {
  /** The page's path with its query and without the locale, so the language switch keeps `returnTo`. */
  path: string;
  articlesMenu: ArticlesMenuEntry[];
  customer?: HeaderCustomer | null;
  /** The page's crumb label, the last item of the trail. */
  breadcrumb: string;
  /** The perks panel beside the card; `null` for verify and forgot password, where the card stands alone. */
  perks: 'signIn' | 'register' | null;
  children: ReactNode;
}) {
  const t = useTranslations('shop.auth.breadcrumb');
  const locale = useLocale();

  return (
    <>
      <SiteHeader path={path} articlesMenu={articlesMenu} customer={customer} />
      <main id="main" className="wrap">
        <Breadcrumbs label={t('label')} items={[{ label: t('home'), href: `/${locale}` }, { label: breadcrumb }]} />
        <div
          className={
            perks === null
              ? 'mx-auto grid max-w-[560px] items-start gap-7 pt-3 pb-12'
              : 'grid items-start gap-7 pt-3 pb-12 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]'
          }
        >
          {children}
          {perks !== null && <AuthPerks variant={perks} />}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
