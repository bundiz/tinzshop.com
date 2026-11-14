'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { routing } from '@/i18n/routing';
import type { PermissionKey } from '@/server/services/access/permission-keys';
import SideNav from './SideNav';

export type AdminShellProps = {
  locale: string;
  permissions: readonly PermissionKey[];
  name: string;
  /** The account's role, already translated. */
  roleLabel: string;
  children: ReactNode;
};

/** The same page in another locale: the path's first segment is the locale (D-031). The query string (a list's filters, its page) is kept. */
function inLocale(pathname: string, query: string, locale: string, target: string): string {
  return pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
    ? `/${target}${pathname.slice(locale.length + 1)}${query === '' ? '' : `?${query}`}`
    : `/${target}/admin`;
}

/**
 * The back office's frame (the mockup's `.shell`): the navy side menu and the top bar with the TH/EN switch, around the
 * page. From `md` the menu is a fixed column. Below it, it is a drawer opened by the top bar's menu button, closed again by
 * Escape, the scrim or following a link, and out of the tab order while closed. The mockup's search box, bell and counts are
 * left out. A Client Component only for the drawer and the current path; the page inside stays a Server Component.
 */
export default function AdminShell({ locale, permissions, name, roleLabel, children }: AdminShellProps) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <div className="min-h-screen bg-page text-[15px] md:grid md:grid-cols-[252px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-70 focus:rounded-sm focus:bg-navy focus:px-4 focus:py-3 focus:text-white"
      >
        {t('skip')}
      </a>
      <nav
        id="admin-side-nav"
        aria-label={t('nav.label')}
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col overflow-auto bg-navy px-3.5 py-[18px] text-on-navy-2 transition-[transform,visibility] duration-[280ms] ease-soft md:sticky md:top-0 md:h-screen md:w-auto md:translate-x-0 md:visible ${
          open ? 'translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <SideNav
          locale={locale}
          permissions={permissions}
          pathname={pathname}
          name={name}
          roleLabel={roleLabel}
          onNavigate={() => setOpen(false)}
        />
      </nav>
      {open ? <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-ink/50 md:hidden" /> : null}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-white/95 px-3 backdrop-blur-[8px] md:px-7">
          <button
            ref={menuButton}
            type="button"
            aria-controls="admin-side-nav"
            aria-expanded={open}
            aria-label={open ? t('nav.close') : t('nav.open')}
            onClick={() => setOpen((current) => !current)}
            className="grid size-11 cursor-pointer place-items-center rounded-[9px] text-ink-2 hover:bg-sunk hover:text-ink md:hidden"
          >
            <Icon name="menu" className="size-5" />
          </button>
          <nav aria-label={t('language.label')} className="ml-auto">
            <ul className="inline-flex gap-0.5 rounded-sm bg-sunk p-[3px]">
              {routing.locales.map((target) => (
                <li key={target}>
                  {target === locale ? (
                    <span
                      aria-current="true"
                      lang={target}
                      className="inline-flex min-h-[34px] min-w-11 items-center justify-center rounded-md bg-white px-2.5 text-[13px] leading-none font-semibold text-ink shadow-1"
                    >
                      {t(`language.${target}`)}
                    </span>
                  ) : (
                    <Link
                      href={inLocale(pathname, query, locale, target)}
                      hrefLang={target}
                      lang={target}
                      aria-label={t(`language.${target}Name`)}
                      className="inline-flex min-h-[34px] min-w-11 items-center justify-center rounded-md px-2.5 text-[13px] leading-none font-semibold text-muted hover:text-ink"
                    >
                      {t(`language.${target}`)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main id="main" className="min-w-0 px-4 pt-[18px] pb-24 md:px-7 md:pt-6 md:pb-14">
          {children}
        </main>
      </div>
    </div>
  );
}
