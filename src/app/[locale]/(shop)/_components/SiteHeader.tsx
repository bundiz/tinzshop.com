import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import Icon, { type IconName } from '@/components/ui/Icon';
import { routing } from '@/i18n/routing';
import { listingHref, NAV_CATEGORY_SLUGS } from '../product/listing-url';
import ArticlesMenu from './ArticlesMenu';
import type { ArticlesMenuEntry } from './articles-menu';
import SearchForm from './SearchForm';

export type SiteHeaderProps = {
  /** The current page's path without the locale, e.g. `/`; the language switch links to it in the other locale. */
  path: string;
  /** The utility bar's "บทความ" menu, built from the listed news categories (`readArticlesMenu`, D-140). */
  articlesMenu: ArticlesMenuEntry[];
  /**
   * The category-nav entry drawn as current: `home` on the landing page, `news` on every news route, and on
   * the product listing the entry its filters match (`listingNav`).
   */
  activeNav?: SiteNavKey;
};

export type SiteNavKey = 'home' | (typeof NAV_CATEGORIES)[number];

type AppLocale = (typeof routing.locales)[number];

const LANGUAGE_NAME_KEY: Record<AppLocale, 'language.thName' | 'language.enName'> = {
  th: 'language.thName',
  en: 'language.enName',
};

const NAV_CATEGORIES = ['switch', 'ps5', 'gadgets', 'preOrder', 'bundles', 'news'] as const;

/** Each product entry of the nav as a product-listing link (plan 013). */
function navHref(locale: string, key: Exclude<(typeof NAV_CATEGORIES)[number], 'news'>): string {
  if (key === 'preOrder') return listingHref(locale, { preOrder: true });
  if (key === 'bundles') return listingHref(locale, { kit: true });
  return listingHref(locale, { category: NAV_CATEGORY_SLUGS[key] });
}

/** The cart count shown until a cart exists: always 0, never the design's sample figure (D-124). */
const CART_COUNT = 0;

/**
 * The storefront header from the design: utility bar (tagline, help links, TH/EN switch), the logo,
 * search, account, wishlist and cart, and the category nav bar. The logo, "home", "หมวดหมู่ทั้งหมด" and the
 * nav's product entries (to the product listing, plan 013), "ข่าวเกม", the utility bar's "บทความ ▾" menu
 * (D-140) and the language switch go somewhere; the rest render as designed and are inert (D-124).
 */
export default function SiteHeader({ path, articlesMenu, activeNav }: SiteHeaderProps) {
  const t = useTranslations('shop.header');
  const tArticles = useTranslations('shop.header.articles');
  const tCategory = useTranslations('shop.category');
  const locale = useLocale();
  const home = `/${locale}`;
  const news = `/${locale}/news`;

  return (
    <>
      <div className="bg-primary-deep text-[13px] text-[#d6e3fa]">
        <div className="mx-auto flex min-h-9 max-w-[1280px] items-center justify-between gap-4 px-4 md:px-6">
          <p className="min-w-0 truncate">{t('tagline')}</p>
          <div className="flex flex-none items-center gap-[18px]">
            {/* Outside the help links, which are hidden on a phone, so it works there by tap; first in the cluster, so its
                submenu has room to open to the right on a desktop. */}
            <ArticlesMenu
              label={tArticles('label')}
              items={articlesMenu.map((entry) => ({
                label: tArticles(entry.labelKey),
                href: entry.href,
                submenuLabel: entry.children.length > 0 ? tArticles('submenu', { name: tArticles(entry.labelKey) }) : null,
                children: entry.children.map((child) => ({ label: child.name, href: child.href })),
              }))}
            />
            <nav aria-label={t('links.label')} className="hidden sm:block">
              <ul className="flex items-center gap-[18px]">
                <li>
                  <a href="#" className="hover:text-white">
                    {t('links.trackOrder')}
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    {t('links.help')}
                  </a>
                </li>
              </ul>
            </nav>
            <nav aria-label={t('language.label')}>
              <ul className="inline-flex overflow-hidden rounded-full border border-white/25 text-xs font-semibold">
                {routing.locales.map((target) => (
                  <li key={target}>
                    {target === locale ? (
                      <span aria-current="true" lang={target} className="block bg-accent px-2.5 py-px text-text">
                        {t(`language.${target}`)}
                      </span>
                    ) : (
                      <Link
                        href={localePath(target, path)}
                        hrefLang={target}
                        lang={target}
                        aria-label={t(LANGUAGE_NAME_KEY[target])}
                        // The hit area grows past the small pill to a 44px tap target (07 Responsive).
                        className="relative block px-2.5 py-px after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] hover:text-white"
                      >
                        {t(`language.${target}`)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
      <header className="sticky top-0 z-20 border-b border-border bg-bg">
        <div className="mx-auto grid max-w-[1280px] grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2.5 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-7 md:px-6 md:py-4">
          <Link href={home} aria-label={t('logo.label')} className="col-start-1 row-start-1 flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="" width={40} height={40} className="size-10" />
            <span>
              <span className="block text-[22px] leading-none font-extrabold tracking-[-0.02em] text-primary">
                {t('logo.wordLead')}
                <b className="text-accent">{t('logo.wordTail')}</b>
              </span>
              <span className="mt-[3px] hidden text-[11px] leading-[1.3] text-text-subtle md:block">
                {t('logo.sub')}
              </span>
            </span>
          </Link>
          <SearchForm className="col-span-3 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1" />
          <nav aria-label={t('actions.label')} className="col-start-3 row-start-1 flex items-center gap-1">
            <HeaderAction icon="user" label={t('actions.account.label')}>
              {t('actions.account.line1')}
              <strong className="block text-[13px]">{t('actions.account.line2')}</strong>
            </HeaderAction>
            <HeaderAction icon="heart" label={t('actions.wishlist.label')}>
              {t('actions.wishlist.line1')}
              <strong className="block text-[13px]">{t('actions.wishlist.line2')}</strong>
            </HeaderAction>
            <HeaderAction
              icon="cart"
              label={t('actions.cart.label', { count: CART_COUNT })}
              count={CART_COUNT}
            >
              {t('actions.cart.line1')}
              <strong className="block text-[13px]">{t('actions.cart.line2', { count: CART_COUNT })}</strong>
            </HeaderAction>
          </nav>
        </div>
      </header>
      <nav aria-label={t('nav.label')} className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-[1280px] items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:px-6 [&::-webkit-scrollbar]:hidden">
          <Link
            href={listingHref(locale)}
            className="mr-2 flex min-h-9 items-center gap-1.5 rounded-(--radius-sm) border-b-2 border-transparent bg-primary px-3 text-sm font-semibold whitespace-nowrap text-white hover:bg-primary-dark"
          >
            <Icon name="menu" className="size-4" />
            {t('nav.all')}
          </Link>
          <NavLink href={home} isActive={activeNav === 'home'}>
            {t('nav.home')}
          </NavLink>
          {NAV_CATEGORIES.map((key) => (
            <NavLink key={key} href={key === 'news' ? news : navHref(locale, key)} isActive={activeNav === key}>
              {tCategory(key)}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}

function localePath(locale: string, path: string): string {
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

function HeaderAction({
  icon,
  label,
  count,
  children,
}: {
  icon: IconName;
  label: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <a
      href="#"
      aria-label={label}
      className="relative flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-(--radius-sm) px-2 py-1 hover:bg-primary-soft hover:text-primary"
    >
      <Icon name={icon} className="size-6" />
      {count !== undefined && (
        <span className="absolute top-0.5 left-5 h-[18px] min-w-[18px] rounded-full bg-danger px-[5px] text-center text-[11px] leading-[18px] font-bold text-white">
          {count}
        </span>
      )}
      <span className="hidden text-xs leading-[1.35] md:block">{children}</span>
    </a>
  );
}

function NavLink({ href, isActive, children }: { href: string; isActive: boolean; children: ReactNode }) {
  const tone = isActive ? 'border-primary text-primary' : 'border-transparent hover:text-primary';
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap ${tone}`}
    >
      {children}
    </Link>
  );
}
