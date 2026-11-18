'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import Icon, { type IconName } from './Icon';

/** One entry of a row menu: a button that runs `onSelect`, or a link to `href`. `danger` draws it in the sale red. */
export type RowAction = {
  key: string;
  label: string;
  icon: IconName;
  tone?: 'default' | 'danger';
} & ({ onSelect: () => void; href?: never } | { href: string; onSelect?: never });

export type RowActionsMenuProps = {
  /** The button's accessible name, naming the row ("จัดการ {name}"); the menu is named the same. */
  label: string;
  items: readonly RowAction[];
  /** The caller's ref to the "⋯" button, so a dialog an item opens can return focus to it. */
  buttonRef?: RefObject<HTMLButtonElement | null>;
};

const GAP = 6;
const MARGIN = 8;

/**
 * A table row's "⋯" menu (D-261): the admin mockup's `.row-act` icon button opening a small menu of actions (WAI-ARIA APG
 * menu button). The button has `aria-haspopup="menu"` and `aria-expanded`; Enter, Space and ArrowDown open the menu on its
 * first item, ArrowUp on its last. Inside, focus is on the items themselves: the arrows (wrapping), Home and End move,
 * Enter and Space activate, Escape and Tab close. Focus goes back to the button after any close but a press outside; an
 * item that opens a dialog then moves it on into the dialog, which returns it to the button when it closes. The menu is
 * drawn in a portal with fixed positioning, as `Select`'s list is, so a table's scroll box cannot clip it: right-aligned
 * to the button, below it, or above it when there is no room below.
 */
export default function RowActionsMenu({ label, items, buttonRef }: RowActionsMenuProps) {
  const menuId = `${useId()}-menu`;
  const ownButton = useRef<HTMLButtonElement>(null);
  const button = buttonRef ?? ownButton;
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) button.current?.focus();
    },
    [button],
  );

  function show(index: number): void {
    setActive(index);
    setOpen(true);
  }

  const itemElements = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      show(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      show(items.length - 1);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const last = items.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((index) => (index >= last ? 0 : index + 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setActive((index) => (index <= 0 ? last : index - 1));
        return;
      case 'Home':
        event.preventDefault();
        setActive(0);
        return;
      case 'End':
        event.preventDefault();
        setActive(last);
        return;
      case 'Enter':
      case ' ':
        // The item's own click does the work, for a button and a link alike.
        event.preventDefault();
        itemElements()[active]?.click();
        return;
      case 'Escape':
        // Handled here: a dialog around the menu must not close with it (useModalDialog skips a prevented Escape).
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case 'Tab':
        // Focus goes back to the button first, so the browser's Tab moves on from the row, not from the end of the page.
        close(true);
        return;
    }
  }

  // Place the menu right-aligned under the button, or above it when there is more room there; keep it placed on scroll.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = button.current;
      const popup = menu.current;
      if (trigger === null || popup === null) return;
      const rect = trigger.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - GAP - MARGIN;
      const above = rect.top - GAP - MARGIN;
      const up = popup.offsetHeight > below && above > below;
      popup.style.top = up ? '' : `${rect.bottom + GAP}px`;
      popup.style.bottom = up ? `${window.innerHeight - rect.top + GAP}px` : '';
      popup.style.left = `${Math.max(MARGIN, Math.min(rect.right - popup.offsetWidth, window.innerWidth - MARGIN - popup.offsetWidth))}px`;
    };
    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [open, button]);

  // Focus follows the active item (after the placement above, so it never lands on an unplaced menu).
  useLayoutEffect(() => {
    if (open) itemElements()[active]?.focus({ preventScroll: true });
  }, [open, active]);

  // A press outside closes it; focus then goes wherever the press puts it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && !(button.current?.contains(target) ?? false) && !(menu.current?.contains(target) ?? false)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close, button]);

  const itemClass = (item: RowAction, index: number) =>
    `flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 py-1 text-left text-sm leading-[1.45] sm:min-h-8 ${
      item.tone === 'danger' ? 'text-sale' : 'text-ink'
    } ${index === active ? 'bg-sunk' : ''}`;

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (open) close(false);
          else show(0);
        }}
        onKeyDown={onButtonKeyDown}
        // Space opens on keydown; stop the button's own Space click on keyup, which would close it again.
        onKeyUp={(event) => {
          if (event.key === ' ') event.preventDefault();
        }}
        // 36px drawn; below `sm` an invisible 4px all round makes the tap target 44px (D-221).
        className="relative grid size-9 cursor-pointer place-items-center rounded-sm text-ink-2 transition-colors hover:bg-sunk hover:text-ink aria-expanded:bg-sunk aria-expanded:text-ink max-sm:after:absolute max-sm:after:-inset-1"
      >
        <Icon name="more" />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menu}
              id={menuId}
              role="menu"
              aria-label={label}
              onKeyDown={onMenuKeyDown}
              style={{ position: 'fixed' }}
              className="z-80 w-max max-w-[calc(100vw-16px)] min-w-[152px] rounded-md border border-line bg-surface p-1 shadow-1"
            >
              {items.map((item, index) => {
                const content = (
                  <>
                    <Icon name={item.icon} className="size-4" />
                    <span className="min-w-0 flex-1">{item.label}</span>
                  </>
                );
                const common = {
                  role: 'menuitem',
                  tabIndex: -1,
                  onPointerMove: () => {
                    if (active !== index) setActive(index);
                  },
                  className: itemClass(item, index),
                } as const;
                return item.href !== undefined ? (
                  <Link key={item.key} href={item.href} {...common} onClick={() => close(true)}>
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    {...common}
                    onClick={() => {
                      close(true);
                      item.onSelect();
                    }}
                  >
                    {content}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
