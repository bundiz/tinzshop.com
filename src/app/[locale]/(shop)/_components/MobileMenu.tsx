'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Icon, { type IconName } from '@/components/ui/Icon';
import { buttonClass } from '@/components/ui/button-class';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import { routing } from '@/i18n/routing';

export type MobileMenuNavItem = {
  label: string;
  /** `#` for an entry that is not built yet (D-124). */
  href: string;
  isCurrent: boolean;
  /** The entry drawn in the sale red. */
  isSale?: boolean;
};

export type MobileMenuProps = {
  navItems: readonly MobileMenuNavItem[];
  /** The sign-in entry shows only when this is false (R8). */
  signedIn: boolean;
  /** The current page in the other language. */
  otherLocaleHref: string;
  /** The other language's own name, "English" or "ภาษาไทย". */
  otherLocaleName: string;
};

/** The width at which the menu button disappears and the drawer has nothing to show (`md`, 860px). */
const WIDE_QUERY = '(min-width: 53.75rem)';

const ROW = 'flex min-h-[52px] items-center gap-3 border-b border-line text-[17px] font-medium hover:text-brand';

const subscribeNothing = () => () => {};

/**
 * The phone menu (plan 015, R8): the menu button for the header row, and the drawer it opens, a modal dialog
 * (`useModalDialog`: focus moves in, Tab stays in, Escape and the close button close it and return focus to the button,
 * the page behind does not scroll). The drawer is drawn into `document.body`: the sticky header's backdrop filter would
 * otherwise turn it into the header's own box. It closes when a link in it is chosen and when the window grows past `md`.
 */
export default function MobileMenu({ navItems, signedIn, otherLocaleHref, otherLocaleName }: MobileMenuProps) {
  const t = useTranslations('shop.header');
  const tContact = useTranslations('shop.contact');
  const locale = useLocale();
  const otherLocale = routing.locales.find((target) => target !== locale) ?? locale;
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const drawerId = useId();
  // The portal needs `document`, so it is drawn after hydration.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);

  useModalDialog({ open, onClose: () => setOpen(false), containerRef: drawerRef, returnFocusRef: buttonRef });

  useEffect(() => {
    if (!open || typeof window.matchMedia !== 'function') return;
    const wide = window.matchMedia(WIDE_QUERY);
    const closeWhenWide = () => {
      if (wide.matches) setOpen(false);
    };
    wide.addEventListener('change', closeWhenWide);
    return () => wide.removeEventListener('change', closeWhenWide);
  }, [open]);

  const close = () => setOpen(false);

  const drawer = (
    <div
      ref={drawerRef}
      id={drawerId}
      tabIndex={-1}
      role={open ? 'dialog' : undefined}
      aria-modal={open ? true : undefined}
      aria-label={open ? t('menu.label') : undefined}
      inert={!open}
      className={`fixed inset-0 z-60 overflow-auto bg-surface px-[clamp(16px,3.2vw,32px)] pt-4 pb-8 transition-[transform,visibility] duration-300 ease-soft motion-reduce:transition-none ${
        open ? 'visible translate-x-0' : 'invisible -translate-x-full'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <Link href={`/${locale}`} aria-label={t('logo.label')} onClick={close} className="flex flex-none items-center gap-2.5">
          <img src="/logo-mark.png" alt="" width={40} height={40} className="size-10 flex-none rounded-full" />
          <span className="font-head text-[22px] leading-none font-bold tracking-[-.02em] text-navy">{t('logo.word')}</span>
        </Link>
        <button
          type="button"
          aria-label={t('menu.close')}
          onClick={close}
          className="inline-flex size-12 cursor-pointer items-center justify-center rounded-sm hover:bg-sunk"
        >
          <Icon name="x" className="size-6" />
        </button>
      </div>
      <nav aria-label={t('nav.label')}>
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.isCurrent ? 'page' : undefined}
            onClick={close}
            className={`${ROW} ${item.isSale ? 'text-sale' : item.isCurrent ? 'font-semibold text-ink' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div>
        <DrawerLink icon="package" href="#" onClick={close}>
          {t('links.myOrders')}
        </DrawerLink>
        <DrawerLink icon="wrench" href="#" onClick={close}>
          {t('drawer.warranty')}
        </DrawerLink>
        {!signedIn && (
          <DrawerLink icon="user" href={`/${locale}/sign-in`} onClick={close}>
            {t('drawer.account')}
          </DrawerLink>
        )}
        <Link href={otherLocaleHref} hrefLang={otherLocale} lang={otherLocale} onClick={close} className={ROW}>
          <Icon name="globe" className="size-5" />
          {otherLocaleName}
        </Link>
        <a href="#" onClick={close} className={`${buttonClass({ variant: 'lineApp', block: true })} mt-5`}>
          <Icon name="chat" className="size-5" />
          {tContact('lineChat')}
        </a>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={drawerId}
        aria-label={t('menu.open')}
        onClick={() => setOpen(true)}
        className="-ml-2.5 inline-flex size-12 cursor-pointer items-center justify-center rounded-sm hover:bg-sunk md:hidden"
      >
        <Icon name="menu" className="size-6" />
      </button>
      {mounted && createPortal(drawer, document.body)}
    </>
  );
}

function DrawerLink({
  icon,
  href,
  onClick,
  children,
}: {
  icon: IconName;
  href: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <Link href={href} onClick={onClick} className={ROW}>
      <Icon name={icon} className="size-5" />
      {children}
    </Link>
  );
}
