import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { platformTone, type PlatformTone } from '@/components/domain/platform-tone';
import Icon, { type IconName } from '@/components/ui/Icon';
import { routing } from '@/i18n/routing';
import { listingHref, NAV_CATEGORY_SLUGS } from '../product/listing-url';
import AccountMenu from './AccountMenu';
import ArticlesMenu from './ArticlesMenu';
import type { ArticlesMenuEntry } from './articles-menu';
import MobileMenu from './MobileMenu';
import SearchForm from './SearchForm';

export type SiteHeaderProps = {
  /** The current page's path without the locale, e.g. `/`; the language switch links to it in the other locale. */
  path: string;
  /** The utility bar's "บทความ" menu, built from the listed news categories (`readArticlesMenu`, D-140). */
  articlesMenu: ArticlesMenuEntry[];
  /**
   * The category-nav entry drawn as current: `home` on the landing page, `news` on every news route, and on
   * the product listing the entry its filters match (`listingNav`). `otherToys` and `sale` are never current (R5).
   */
  activeNav?: SiteNavKey;
  /**
   * The signed-in customer, from `readCurrentCustomer()`. Every page that draws the header passes it: with a customer
   * the account entry shows the first name and a sign-out menu (D-170); without one it links to sign-in.
   */
  customer?: { firstName: string } | null;
};

export type SiteNavKey = 'home' | (typeof NAV_CATEGORIES)[number];

type AppLocale = (typeof routing.locales)[number];

const LANGUAGE_NAME_KEY: Record<AppLocale, 'language.thName' | 'language.enName'> = {
  th: 'language.thName',
  en: 'language.enName',
};

/** The nav after "หน้าแรก", in the design's order (plan 015, R8). */
const NAV_CATEGORIES = ['ps5', 'switch', 'gadgets', 'preOrder', 'bundles', 'otherToys', 'sale', 'news'] as const;

/** The colour dot before a platform entry; literal class names so Tailwind sees them. */
const DOT: Record<PlatformTone, string> = { ps: 'bg-ps', ns: 'bg-ns', it: 'bg-it', other: 'bg-other' };
const DOT_TONE: Partial<Record<(typeof NAV_CATEGORIES)[number], PlatformTone>> = {
  ps5: platformTone(NAV_CATEGORY_SLUGS.ps5),
  switch: platformTone(NAV_CATEGORY_SLUGS.switch),
  gadgets: platformTone(NAV_CATEGORY_SLUGS.gadgets),
  otherToys: platformTone(null),
};

/** Each entry of the nav as a link: the product ones to the product listing (plan 013), the two not built yet inert at `#` (R5). */
function navHref(locale: string, key: (typeof NAV_CATEGORIES)[number]): string {
  switch (key) {
    case 'news':
      return `/${locale}/news`;
    case 'otherToys':
    case 'sale':
      return '#';
    case 'preOrder':
      return listingHref(locale, { preOrder: true });
    case 'bundles':
      return listingHref(locale, { kit: true });
    default:
      return listingHref(locale, { category: NAV_CATEGORY_SLUGS[key] });
  }
}

/** The cart count shown until a cart exists: always 0, never the design's sample figure (D-124). */
const CART_COUNT = 0;

const TOP_LINK = 'inline-flex min-h-10 items-center gap-1.5 text-on-navy hover:text-white hover:underline hover:underline-offset-[3px]';

/**
 * The storefront header from the redesign (plan 015): the skip link, the top bar (message, the "บทความ" menu, help
 * links, TH/EN switch), the sticky header (menu button and drawer on a phone, logo, search, account, wishlist, cart) and
 * the category nav. The logo, "home", the nav's product entries (to the product listing, plan 013), "ข่าวเกม", the
 * "บทความ ▾" menu (D-140), the account entry and the language switch go somewhere; the rest render as designed and
 * are inert (D-124).
 */
export default function SiteHeader({ path, articlesMenu, activeNav, customer = null }: SiteHeaderProps) {
  const t = useTranslations('shop.header');
  const tArticles = useTranslations('shop.header.articles');
  const tCategory = useTranslations('shop.category');
  const locale = useLocale();
  const home = `/${locale}`;
  const otherLocale = routing.locales.find((target) => target !== locale) ?? routing.locales[0];

  const navItems = [
    { key: 'home' as const, label: t('nav.home'), href: home },
    ...NAV_CATEGORIES.map((key) => ({ key, label: tCategory(key), href: navHref(locale, key) })),
  ].map((item) => ({ ...item, isCurrent: item.key !== 'otherToys' && item.key !== 'sale' && item.key === activeNav }));

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-70 focus:rounded-sm focus:bg-navy focus:px-4 focus:py-3 focus:text-white"
      >
        {t('skip')}
      </a>
      <div className="bg-navy text-sm text-on-navy-2">
        <div className="wrap flex min-h-11 items-center justify-between gap-4 md:min-h-10">
          <p className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="size-[7px] flex-none rounded-full bg-[#2bd576] shadow-[0_0_0_3px_rgba(43,213,118,.18)]" />
            <span>
              {t.rich('tagline', {
                b: (chunks) => <b className="font-semibold text-white">{chunks}</b>,
                rest: (chunks) => <span className="hidden sm:inline">{chunks}</span>,
              })}
            </span>
          </p>
          <div className="flex flex-none items-center gap-5">
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
            <nav aria-label={t('links.label')} className="hidden md:block">
              <ul className="flex items-center gap-5">
                <TopLink icon="package">{t('links.myOrders')}</TopLink>
                <TopLink icon="wrench">{t('links.warranty')}</TopLink>
                <TopLink icon="chat">{t('links.line')}</TopLink>
              </ul>
            </nav>
            <nav aria-label={t('language.label')} className="flex items-center gap-1.5">
              <Icon name="globe" className="size-4" />
              <ul className="flex items-center">
                {routing.locales.map((target, index) => (
                  <li key={target} className={index > 0 ? "before:text-on-navy-2 before:content-['·']" : undefined}>
                    {target === locale ? (
                      <span
                        aria-current="true"
                        lang={target}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-white md:min-h-10 md:min-w-0 md:px-2"
                      >
                        {t(`language.${target}`)}
                      </span>
                    ) : (
                      <Link
                        href={localePath(target, path)}
                        hrefLang={target}
                        lang={target}
                        aria-label={t(LANGUAGE_NAME_KEY[target])}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center text-on-navy hover:text-white hover:underline hover:underline-offset-[3px] md:min-h-10 md:min-w-0 md:px-2"
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
      <header className="sticky top-0 z-40 border-b border-line bg-white/96 backdrop-blur-[8px] backdrop-saturate-[1.4]">
        <div className="wrap flex flex-wrap items-center gap-x-2 gap-y-2 pt-2.5 pb-3 md:min-h-[76px] md:flex-nowrap md:gap-6 md:py-0">
          <MobileMenu
            navItems={navItems.map((item) => ({
              label: item.label,
              href: item.href,
              isCurrent: item.isCurrent,
              isSale: item.key === 'sale',
            }))}
            signedIn={customer !== null}
            otherLocaleHref={localePath(otherLocale, path)}
            otherLocaleName={t(LANGUAGE_NAME_KEY[otherLocale])}
          />
          <Link href={home} aria-label={t('logo.label')} className="flex flex-none items-center gap-2.5">
            <img src="/logo-mark.png" alt="" width={40} height={40} className="size-10 flex-none rounded-full" />
            <span className="font-head text-[22px] leading-none font-bold tracking-[-.02em] text-navy">{t('logo.word')}</span>
          </Link>
          <SearchForm className="order-last basis-full md:order-none md:basis-auto md:flex-1" />
          <nav aria-label={t('actions.label')} className="ml-auto flex items-center md:ml-0 md:gap-1">
            {customer === null ? (
              <HeaderAction icon="user" label={t('actions.account.label')} href={`${home}/sign-in`}>
                <small>{t('actions.account.line1')}</small>
                <strong>{t('actions.account.line2')}</strong>
              </HeaderAction>
            ) : (
              <AccountMenu firstName={customer.firstName} />
            )}
            <HeaderAction icon="heart" label={t('actions.wishlist.label')}>
              <small>{t('actions.wishlist.line1')}</small>
              <strong>{t('actions.wishlist.line2')}</strong>
            </HeaderAction>
            <HeaderAction icon="cart" label={t('actions.cart.label', { count: CART_COUNT })} count={CART_COUNT}>
              <small>{t('actions.cart.line1')}</small>
              <strong>{t('actions.cart.line2', { count: CART_COUNT })}</strong>
            </HeaderAction>
          </nav>
        </div>
        <nav aria-label={t('nav.label')} className="hidden border-t border-line md:block">
          <ul className="wrap flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => (
              <li key={item.key}>
                <NavLink
                  href={item.href}
                  isActive={item.isCurrent}
                  isSale={item.key === 'sale'}
                  dot={DOT_TONE[item.key as (typeof NAV_CATEGORIES)[number]]}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
    </>
  );
}

function localePath(locale: string, path: string): string {
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/** An inert top-bar link: it looks as designed and goes nowhere (D-124). */
function TopLink({ icon, children }: { icon: IconName; children: string }) {
  return (
    <li>
      <a href="#" className={TOP_LINK}>
        <Icon name={icon} className="size-4" />
        {children}
      </a>
    </li>
  );
}

function HeaderAction({
  icon,
  label,
  count,
  href = '#',
  children,
}: {
  icon: IconName;
  label: string;
  count?: number;
  /** Where it goes; the entries that are not built yet stay inert at `#` (D-124). */
  href?: string;
  /** The small line, then the strong line. */
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="relative flex min-h-12 min-w-11 items-center justify-center gap-2 rounded-sm px-2.5 text-sm leading-tight transition-colors duration-[180ms] hover:bg-sunk md:px-3"
    >
      <Icon name={icon} className="size-6" />
      {count !== undefined && (
        <span className="absolute top-[5px] left-[26px] h-5 min-w-5 rounded-[10px] bg-accent px-[5px] text-center font-body text-xs leading-5 font-bold text-ink">
          {count}
        </span>
      )}
      <span className="hidden md:block [&>small]:hidden [&>small]:text-xs [&>small]:text-muted xl:[&>small]:block [&>strong]:block [&>strong]:font-semibold">
        {children}
      </span>
    </a>
  );
}

function NavLink({
  href,
  isActive,
  isSale,
  dot,
  children,
}: {
  href: string;
  isActive: boolean;
  isSale: boolean;
  dot?: PlatformTone;
  children: ReactNode;
}) {
  const tone = isActive
    ? 'border-accent font-semibold text-ink'
    : `border-transparent font-medium hover:text-brand ${isSale ? 'text-sale' : 'text-ink-2'}`;
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`flex min-h-12 items-center gap-2 border-b-2 px-3.5 text-[15px] whitespace-nowrap transition-colors duration-[180ms] ${tone}`}
    >
      {dot !== undefined && <span aria-hidden="true" className={`size-[9px] flex-none rounded-[3px] ${DOT[dot]}`} />}
      {children}
    </Link>
  );
}
