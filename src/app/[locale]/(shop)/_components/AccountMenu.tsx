'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import Icon from '@/components/ui/Icon';
import { signOutAction } from '../(auth)/actions';

export type AccountMenuProps = {
  /** The signed-in customer's first name. */
  firstName: string;
};

/**
 * The signed-in header's account entry: the first name, and a small menu holding "ออกจากระบบ" (D-170). A disclosure,
 * not an ARIA `menu`: a button with `aria-expanded` that shows a panel. Escape wherever focus is (focus goes back to the button),
 * a click outside and moving focus out all close it; the panel is in the page's tab order only while open.
 */
export default function AccountMenu({ firstName }: AccountMenuProps) {
  const t = useTranslations('shop.auth.menu');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    // Escape closes it wherever focus is, as the articles menu does (07); focus goes back to the button.
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const closeOnOutside = (event: PointerEvent) => {
      if (root.current !== null && event.target instanceof Node && !root.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const closeOnFocusLeave = (event: FocusEvent) => {
    if (!(event.relatedTarget instanceof Node) || root.current?.contains(event.relatedTarget)) return;
    setOpen(false);
  };

  return (
    <div ref={root} className="relative" onBlur={closeOnFocusLeave}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('label', { name: firstName })}
        onClick={() => setOpen((current) => !current)}
        className="relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-(--radius-sm) px-2 py-1 hover:bg-primary-soft hover:text-primary"
      >
        <Icon name="user" className="size-6" />
        <span className="hidden text-left text-xs leading-[1.35] md:block">
          {t('hello')}
          <strong className="block max-w-[110px] truncate text-[13px]">{firstName}</strong>
        </span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 z-30 mt-1 w-44 rounded-(--radius-sm) border border-border bg-bg p-1 shadow-hover"
      >
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="min-h-11 w-full cursor-pointer rounded-(--radius-sm) px-3 text-left text-sm font-medium hover:bg-primary-soft hover:text-primary"
          >
            {t('signOut')}
          </button>
        </form>
      </div>
    </div>
  );
}
