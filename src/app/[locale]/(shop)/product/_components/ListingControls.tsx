'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import Icon from '@/components/ui/Icon';
import Select from '@/components/ui/Select';
import { buttonClass } from '@/components/ui/button-class';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import {
  STOREFRONT_LISTING_SORTS,
  type StorefrontListingParams,
  type StorefrontListingSort,
} from '@/server/services/catalogue/storefront-listing-service';
import { listingHref, nextListing } from '../listing-url';

/**
 * The listing's client controls (plan 013 Task 4): each one rewrites the URL with `router.push`, so the
 * page itself stays server-rendered and `force-dynamic`, and back/forward walks the filter history. The
 * URLs come from the pure `listing-url` helpers, which never emit an empty param.
 */

/** A client-side navigation to `href` that keeps the scroll position. */
function useListingNavigation(): [isPending: boolean, go: (href: string, before?: () => void) => void] {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const go = (href: string, before?: () => void) =>
    startTransition(() => {
      before?.();
      router.push(href, { scroll: false });
    });
  return [isPending, go];
}

/** One sidebar checkbox; its URL for the other state is worked out on the server. */
export function ListingCheck({
  label,
  count,
  checked,
  href,
}: {
  label: string;
  count?: number;
  checked: boolean;
  /** The listing with this box toggled. */
  href: string;
}) {
  const [shown, setShown] = useOptimistic(checked);
  const [, go] = useListingNavigation();
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] sm:min-h-10">
      <input
        type="checkbox"
        checked={shown}
        onChange={() => go(href, () => setShown(!checked))}
        className="size-5 flex-none accent-ink"
      />
      {label}
      {count !== undefined && <span className="ml-auto text-[13px] text-muted">{count}</span>}
    </label>
  );
}

/** Whole baht from an input's text, or `null` for empty or not a whole number (R2 ignores it anyway). */
export function parseBahtInput(text: string): number | null {
  const trimmed = text.trim();
  return /^[0-9]{1,12}$/.test(trimmed) ? Number(trimmed) : null;
}

/** What a price input shows for a URL value. */
const bahtText = (value: number | null): string => (value === null ? '' : String(value));

/**
 * One price input, controlled: what is typed stays local until blur or Enter, and a new URL value (another
 * control, back/forward) replaces it. It is never remounted, so it keeps focus after Enter.
 */
function PriceInput({
  value,
  label,
  placeholder,
  onApply,
}: {
  value: number | null;
  label: string;
  placeholder: string;
  /** Called with the new whole-baht value (`null` clears the bound) when it differs from `value`. */
  onApply: (next: number | null) => void;
}) {
  const [text, setText] = useState(bahtText(value));
  // Resync when the URL's value changes (React's "adjust state when a prop changes" pattern).
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(bahtText(value));
  }
  const apply = () => {
    const trimmed = text.trim();
    const next = parseBahtInput(trimmed);
    // An entry that is not whole baht (or a non-canonical one, "0100") goes back to what the URL holds.
    if (trimmed !== '' && next === null) {
      setText(bahtText(value));
      return;
    }
    if (next === value) {
      setText(bahtText(value));
      return;
    }
    onApply(next);
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onChange={(event) => setText(event.currentTarget.value)}
      onBlur={apply}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') apply();
      }}
      className="min-h-12 w-full min-w-0 rounded-sm border-[1.5px] border-line-2 bg-surface px-3.5 text-base focus:border-ink focus:outline-none"
    />
  );
}

/** The ช่วงราคา inputs: a change applies on blur or Enter, never on every keystroke. */
export function ListingPriceRange({
  locale,
  active,
  labels,
}: {
  locale: string;
  active: StorefrontListingParams;
  labels: { min: string; max: string; minPlaceholder: string; maxPlaceholder: string };
}) {
  const [, go] = useListingNavigation();
  // Enter then blur would apply the same change twice before the new URL arrives; keyed by the URL it
  // started from, and forgotten once the listing changes (the new URL, a chip, back/forward), so the same
  // change made again later still applies.
  const current = listingHref(locale, active);
  const pending = useRef<string | null>(null);
  useEffect(() => {
    pending.current = null;
  }, [current]);
  const apply = (key: 'minBaht' | 'maxBaht') => (next: number | null) => {
    const href = listingHref(locale, nextListing(active, { [key]: next }));
    const change = `${current} -> ${href}`;
    if (pending.current === change) return;
    pending.current = change;
    go(href);
  };
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <PriceInput
        value={active.minBaht}
        label={labels.min}
        placeholder={labels.minPlaceholder}
        onApply={apply('minBaht')}
      />
      <span aria-hidden="true">–</span>
      <PriceInput
        value={active.maxBaht}
        label={labels.max}
        placeholder={labels.maxPlaceholder}
        onApply={apply('maxBaht')}
      />
    </div>
  );
}

/** The toolbar's sort select. */
export function ListingSortSelect({
  locale,
  active,
  label,
  options,
}: {
  locale: string;
  active: StorefrontListingParams;
  label: string;
  options: Record<StorefrontListingSort, string>;
}) {
  const [, go] = useListingNavigation();
  return (
    <Select
      aria-label={label}
      value={active.sort}
      onChange={(sort) => go(listingHref(locale, nextListing(active, { sort: sort as StorefrontListingSort })))}
      options={STOREFRONT_LISTING_SORTS.map((sort) => ({ value: sort, label: options[sort] }))}
    />
  );
}

/** The toolbar's grid/list switch (from 640px, as the design). */
export function ListingViewToggle({
  active,
  hrefs,
  labels,
}: {
  active: StorefrontListingParams['view'];
  hrefs: { grid: string; list: string };
  labels: { group: string; grid: string; list: string };
}) {
  const [, go] = useListingNavigation();
  const button = (view: 'grid' | 'list') => (
    <button
      type="button"
      aria-label={labels[view]}
      aria-pressed={active === view}
      onClick={() => {
        if (active !== view) go(hrefs[view]);
      }}
      className={`grid size-11 cursor-pointer place-items-center border-0 ${
        active === view ? 'bg-brand text-white' : 'bg-surface text-muted'
      }`}
    >
      <Icon name={view} className="size-4" />
    </button>
  );
  return (
    <div role="group" aria-label={labels.group} className="hidden overflow-hidden rounded-sm border-[1.5px] border-line-2 sm:inline-flex">
      {button('grid')}
      {button('list')}
    </div>
  );
}

type FilterPanelState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
};

const FilterPanelContext = createContext<FilterPanelState | null>(null);

function useFilterPanel(): FilterPanelState {
  const state = useContext(FilterPanelContext);
  if (state === null) throw new Error('The filter panel parts must sit inside ListingFilterPanelProvider.');
  return state;
}

export const LISTING_FILTERS_ID = 'listing-filters';

/** The width from which the filters are a sidebar and the sheet has nothing to show (`lg`, 1024px). */
const WIDE_QUERY = '(min-width: 64rem)';

/**
 * Holds whether the filter sheet is open below 1024px (plan 015, R12, D-217). While open the panel is a modal
 * dialog (`useModalDialog`: focus moves in, Tab stays in, Escape closes and returns focus to "ตัวกรอง"); it also
 * closes when the window grows past `lg`, where the sidebar always shows.
 */
export function ListingFilterPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalDialog({ open, onClose: () => setOpen(false), containerRef: panelRef, returnFocusRef: buttonRef });

  useEffect(() => {
    if (!open || typeof window.matchMedia !== 'function') return;
    const wide = window.matchMedia(WIDE_QUERY);
    const closeWhenWide = () => {
      if (wide.matches) setOpen(false);
    };
    wide.addEventListener('change', closeWhenWide);
    return () => wide.removeEventListener('change', closeWhenWide);
  }, [open]);

  return (
    <FilterPanelContext.Provider value={{ open, setOpen, buttonRef, panelRef }}>{children}</FilterPanelContext.Provider>
  );
}

/** The toolbar's "ตัวกรอง" button: opens the sheet below 1024px, and is not drawn from there. */
export function ListingFilterToggle({ label }: { label: string }) {
  const { open, setOpen, buttonRef } = useFilterPanel();
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-expanded={open}
      aria-controls={LISTING_FILTERS_ID}
      aria-haspopup="dialog"
      onClick={() => setOpen(!open)}
      className={`${buttonClass({ variant: 'line' })} min-h-11 px-4 text-[15px] lg:hidden`}
    >
      <Icon name="filter" className="size-4" />
      {label}
    </button>
  );
}

/**
 * The filters: a sticky 268px column from `lg`, and below it a full-screen sheet that is hidden until the toggle
 * opens it. It has the dialog role only while open; from `lg` it is a complementary region. Its head and its
 * bottom bar ("แสดง {count} รายการ") are for the sheet only.
 */
export function ListingFilterPanel({
  label,
  heading,
  closeLabel,
  applyLabel,
  children,
}: {
  /** The landmark's and the dialog's accessible name. */
  label: string;
  /** The sheet's visible heading ("ตัวกรอง"). */
  heading: string;
  closeLabel: string;
  /** "แสดง {count} รายการ". */
  applyLabel: string;
  children: ReactNode;
}) {
  const { open, setOpen, panelRef } = useFilterPanel();
  const close = () => setOpen(false);
  return (
    <div
      ref={panelRef}
      id={LISTING_FILTERS_ID}
      tabIndex={-1}
      role={open ? 'dialog' : 'complementary'}
      aria-modal={open ? true : undefined}
      aria-label={label}
      className={`${
        open ? 'block' : 'hidden'
      } fixed inset-0 z-70 min-w-0 overflow-auto bg-surface px-[clamp(16px,3.2vw,32px)] pt-4 pb-[100px] lg:sticky lg:inset-auto lg:top-[140px] lg:z-auto lg:block lg:overflow-visible lg:rounded-lg lg:border lg:border-line lg:px-5 lg:py-1.5`}
    >
      <div className="flex items-center justify-between pb-2 lg:hidden">
        <b className="font-head text-xl">{heading}</b>
        <button
          type="button"
          aria-label={closeLabel}
          onClick={close}
          className="inline-flex size-12 cursor-pointer items-center justify-center rounded-sm hover:bg-sunk"
        >
          <Icon name="x" className="size-6" />
        </button>
      </div>
      {children}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface px-[clamp(16px,3.2vw,32px)] py-3 lg:hidden">
        <button type="button" onClick={close} className={buttonClass({ variant: 'brand', block: true })}>
          {applyLabel}
        </button>
      </div>
    </div>
  );
}
