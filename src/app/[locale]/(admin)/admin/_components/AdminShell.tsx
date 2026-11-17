'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Icon from '@/components/ui/Icon';
import { ToastProvider } from '@/components/ui/Toast';
import type { PermissionKey } from '@/server/services/access/permission-keys';
import { adminBreadcrumbs } from './admin-breadcrumbs';
import { PAGE_ACTIONS_ID } from './PageActions';
import SideNav from './SideNav';

export type AdminShellProps = {
  locale: string;
  permissions: readonly PermissionKey[];
  name: string;
  /** The account's role, already translated. */
  roleLabel: string;
  children: ReactNode;
};

/**
 * The back office's frame (the mockup's `.shell`): the navy side menu and the top bar with the TH/EN switch, around the
 * page. From `md` the menu is a fixed column. Below it, it is a drawer opened by the top bar's menu button, closed again by
 * Escape, the scrim or following a link, and out of the tab order while closed. The mockup's search box, bell and counts are
 * left out. A Client Component only for the drawer and the current path; the page inside stays a Server Component. It holds
 * the back office's one `ToastProvider` (D-262), so any back-office form can show a success toast; the storefront has none.
 */
export default function AdminShell({ locale, permissions, name, roleLabel, children }: AdminShellProps) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const crumbs = adminBreadcrumbs(pathname, locale);

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
    <ToastProvider closeLabel={t('toast.close')}>
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
          <main id="main" className="min-w-0 px-4 pt-[18px] pb-24 md:px-7 md:pt-6 md:pb-14">
            {/* No header bar (owner, 2026-11-17): the phone menu button, and an editor page's trail. A section page shows the row only below md. */}
            <div className={`mb-4 flex items-center gap-2 md:gap-3${crumbs.length === 0 ? ' md:hidden' : ''}`}>
              <button
                ref={menuButton}
                type="button"
                aria-controls="admin-side-nav"
                aria-expanded={open}
                aria-label={open ? t('nav.close') : t('nav.open')}
                onClick={() => setOpen((current) => !current)}
                className="grid size-11 flex-none cursor-pointer place-items-center rounded-[9px] text-ink-2 hover:bg-white hover:text-ink md:hidden"
              >
                <Icon name="menu" className="size-5" />
              </button>
              {crumbs.length > 0 ? (
                // The page bar: the trail on the left, the page's own actions (PageActions, D-264) on the right.
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-surface py-1 pr-2 pl-4">
                  <Breadcrumbs
                    variant="bar"
                    label={t('news.editor.breadcrumbLabel')}
                    items={crumbs.map((crumb) => ({ label: t(crumb.key), href: crumb.href }))}
                  />
                  <div id={PAGE_ACTIONS_ID} className="ml-auto flex flex-wrap items-center gap-2 py-1 empty:hidden"></div>
                </div>
              ) : null}
            </div>
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
