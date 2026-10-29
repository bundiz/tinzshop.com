'use client';

import Link from 'next/link';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import Icon from '@/components/ui/Icon';

export type ArticlesMenuLink = { label: string; href: string };

/** One item with its submenu; `submenuLabel` names the submenu's toggle and is null when it has none. */
export type ArticlesMenuItem = ArticlesMenuLink & { submenuLabel: string | null; children: ArticlesMenuLink[] };

export type ArticlesMenuProps = {
  /** The button's text, "บทความ". */
  label: string;
  items: ArticlesMenuItem[];
};

/** Whether the panel is open, and which item's submenu (by its href), if any. */
export type ArticlesMenuState = { open: boolean; submenu: string | null };

export type ArticlesMenuAction =
  | { type: 'toggle' | 'open' | 'close' | 'closeSubmenu' }
  | { type: 'toggleSubmenu' | 'openSubmenu'; key: string };

export const CLOSED: ArticlesMenuState = { open: false, submenu: null };

/** The menu's whole behaviour as a pure function, so it is tested without a browser. */
export function articlesMenuReducer(state: ArticlesMenuState, action: ArticlesMenuAction): ArticlesMenuState {
  switch (action.type) {
    case 'toggle':
      return state.open ? CLOSED : { open: true, submenu: null };
    case 'open':
      return state.open ? state : { open: true, submenu: null };
    case 'close':
      return CLOSED;
    case 'openSubmenu':
      return state.open ? { open: true, submenu: action.key } : state;
    case 'toggleSubmenu':
      return state.open ? { open: true, submenu: state.submenu === action.key ? null : action.key } : state;
    case 'closeSubmenu':
      return { ...state, submenu: null };
  }
}

/**
 * Only a mouse hovers. A tap also sends pointer enter, which would open the menu just before the tap's click
 * toggled it shut again, so touch and pen work by tap alone.
 */
export function isHoverPointer(pointerType: string): boolean {
  return pointerType === 'mouse';
}

/**
 * Whether a submenu opened to the right would run past the viewport's right edge, so it flips left. Only the
 * flyout (from `md`) can: below `md` the submenu sits inside the panel.
 */
export function shouldFlipLeft(submenuRight: number, viewportWidth: number): boolean {
  return submenuRight > viewportWidth;
}

/**
 * The utility bar's "บทความ ▾" menu (D-140): a disclosure button whose panel lists the items, one with a
 * submenu ("News ›"). It opens on hover and on click, Enter or Space, and closes on Escape (focus returns to
 * the button), when focus leaves it, when the pointer leaves it, or on a tap outside. The panel is aligned to
 * the button's right edge; below `md` the submenu opens inside the panel, and from `md` it opens to the right of
 * the panel, flush against it and level with its row, as on the old site, flipping left only when it would run
 * past the viewport's right edge. Renders nothing when there is no item.
 */
export default function ArticlesMenu({ label, items }: ArticlesMenuProps) {
  const [state, dispatch] = useReducer(articlesMenuReducer, CLOSED);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // A pointer over the menu: a blur then is the pointer's own click (Safari moves no focus to a link), not focus leaving.
  const pointerInside = useRef(false);
  const submenuRefs = useRef<Record<string, HTMLUListElement | null>>({});
  const [flipLeft, setFlipLeft] = useState(false);

  // Measured before paint, in the right-hand position, each time a submenu opens.
  useLayoutEffect(() => {
    if (state.submenu === null) {
      setFlipLeft(false);
      return;
    }
    const element = submenuRefs.current[state.submenu];
    if (element === null || element === undefined) return;
    setFlipLeft(shouldFlipLeft(element.getBoundingClientRect().right, document.documentElement.clientWidth));
  }, [state.submenu]);

  useEffect(() => {
    if (!state.open) return;
    // A tap or click outside closes it; a tapped button gets no focus on iOS, so blur alone would not.
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) dispatch({ type: 'close' });
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [state.open]);

  if (items.length === 0) return null;

  const panelId = `${id}-panel`;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' || !state.open) return;
    event.preventDefault();
    dispatch({ type: 'close' });
    buttonRef.current?.focus();
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (pointerInside.current || (next instanceof Node && event.currentTarget.contains(next))) return;
    dispatch({ type: 'close' });
  }

  function onPointerEnter(event: PointerEvent<HTMLDivElement>) {
    pointerInside.current = true;
    if (isHoverPointer(event.pointerType)) dispatch({ type: 'open' });
  }

  function onPointerLeave(event: PointerEvent<HTMLDivElement>) {
    pointerInside.current = false;
    if (isHoverPointer(event.pointerType)) dispatch({ type: 'close' });
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={state.open}
        aria-controls={panelId}
        onClick={() => dispatch({ type: 'toggle' })}
        // The hit area grows past the text to a 44px tap target (07 Responsive).
        className={`relative flex cursor-pointer items-center gap-1 after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] hover:text-white ${state.open ? 'text-white' : ''}`}
      >
        {label}
        <Icon name="chevDown" className={`size-3.5 transition-transform ${state.open ? 'rotate-180' : ''}`} />
      </button>
      {/* The padding bridges the gap under the button, so the pointer never leaves the menu on its way down. */}
      <div id={panelId} hidden={!state.open} className="absolute top-full right-0 z-30 pt-2">
        <ul className="w-56 rounded-(--radius-sm) border border-border bg-bg py-1.5 text-sm text-text shadow-lg">
          {items.map((item, index) => {
            const submenuId = `${id}-submenu-${index}`;
            const hasSubmenu = item.children.length > 0 && item.submenuLabel !== null;
            const submenuOpen = state.submenu === item.href;
            return (
              <li
                key={item.href}
                className="relative"
                onPointerEnter={(event) => {
                  if (hasSubmenu && isHoverPointer(event.pointerType)) dispatch({ type: 'openSubmenu', key: item.href });
                }}
                onPointerLeave={(event) => {
                  if (hasSubmenu && isHoverPointer(event.pointerType)) dispatch({ type: 'closeSubmenu' });
                }}
              >
                <div className="flex items-stretch">
                  <Link
                    href={item.href}
                    className="flex min-h-11 flex-1 items-center px-4 hover:bg-primary-soft hover:text-primary"
                  >
                    {item.label}
                  </Link>
                  {hasSubmenu && (
                    <button
                      type="button"
                      aria-label={item.submenuLabel ?? undefined}
                      aria-expanded={submenuOpen}
                      aria-controls={submenuId}
                      onClick={() => dispatch({ type: 'toggleSubmenu', key: item.href })}
                      className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center text-text-muted hover:bg-primary-soft hover:text-primary"
                    >
                      {/* "›": below md the submenu opens downwards inside the panel (the chevron turns down); from md, to the right. */}
                      <Icon
                        name="chevRight"
                        className={`size-4 transition-transform ${submenuOpen ? 'rotate-90 md:rotate-0' : ''}`}
                      />
                    </button>
                  )}
                </div>
                {hasSubmenu && (
                  <ul
                    ref={(element) => {
                      submenuRefs.current[item.href] = element;
                    }}
                    id={submenuId}
                    hidden={!submenuOpen}
                    className={`border-t border-border bg-bg-subtle py-1 md:absolute md:top-0 md:w-52 md:rounded-(--radius-sm) md:border md:bg-bg md:py-1.5 md:shadow-lg ${
                      submenuOpen && flipLeft ? 'md:right-full' : 'md:left-full'
                    }`}
                  >
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className="flex min-h-11 items-center px-6 hover:bg-primary-soft hover:text-primary md:px-4"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
