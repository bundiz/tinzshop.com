'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useOptimistic,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import Icon from '@/components/ui/Icon';
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
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm md:min-h-[34px]">
      <input
        type="checkbox"
        checked={shown}
        onChange={() => go(href, () => setShown(!checked))}
        className="size-[18px] flex-none accent-primary"
      />
      {label}
      {count !== undefined && <span className="ml-auto text-xs text-text-subtle">{count}</span>}
    </label>
  );
}

/** Whole baht from an input's text, or `null` for empty or not a whole number (R2 ignores it anyway). */
export function parseBahtInput(text: string): number | null {
  const trimmed = text.trim();
  return /^[0-9]{1,12}$/.test(trimmed) ? Number(trimmed) : null;
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
  const apply = (key: 'minBaht' | 'maxBaht', text: string) => {
    const value = parseBahtInput(text);
    if (value === active[key]) return;
    go(listingHref(locale, nextListing(active, { [key]: value })));
  };
  const onKeyDown = (key: 'minBaht' | 'maxBaht') => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') apply(key, event.currentTarget.value);
  };
  const input =
    'h-[38px] w-full min-w-0 rounded-(--radius-sm) border border-border px-2.5 text-sm focus:border-primary focus:outline-none';
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
      <input
        // A new URL value resets what is typed.
        key={`min-${active.minBaht}`}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        aria-label={labels.min}
        placeholder={labels.minPlaceholder}
        defaultValue={active.minBaht ?? ''}
        onBlur={(event) => apply('minBaht', event.currentTarget.value)}
        onKeyDown={onKeyDown('minBaht')}
        className={input}
      />
      <span aria-hidden="true">–</span>
      <input
        key={`max-${active.maxBaht}`}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        aria-label={labels.max}
        placeholder={labels.maxPlaceholder}
        defaultValue={active.maxBaht ?? ''}
        onBlur={(event) => apply('maxBaht', event.currentTarget.value)}
        onKeyDown={onKeyDown('maxBaht')}
        className={input}
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
    <span className="relative inline-flex min-w-0">
      <select
        aria-label={label}
        value={active.sort}
        onChange={(event) =>
          go(listingHref(locale, nextListing(active, { sort: event.currentTarget.value as StorefrontListingSort })))
        }
        className="h-10 min-w-0 cursor-pointer appearance-none rounded-full border border-border bg-bg pr-8 pl-3 text-sm"
      >
        {STOREFRONT_LISTING_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {options[sort]}
          </option>
        ))}
      </select>
      <Icon name="chevDown" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-text-muted" />
    </span>
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
      className={`grid h-[38px] w-10 cursor-pointer place-items-center border-0 ${
        active === view ? 'bg-primary text-white' : 'bg-bg text-text-subtle'
      }`}
    >
      <Icon name={view} className="size-4" />
    </button>
  );
  return (
    <div role="group" aria-label={labels.group} className="hidden overflow-hidden rounded-full border border-border sm:inline-flex">
      {button('grid')}
      {button('list')}
    </div>
  );
}

const FilterPanelContext = createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} });

export const LISTING_FILTERS_ID = 'listing-filters';

/** Holds whether the "ตัวกรอง" panel is open below 900px; from 900px the sidebar always shows. */
export function ListingFilterPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <FilterPanelContext.Provider value={{ open, toggle: () => setOpen((value) => !value) }}>
      {children}
    </FilterPanelContext.Provider>
  );
}

/** The toolbar's "ตัวกรอง" button, a disclosure for the sidebar below 900px. */
export function ListingFilterToggle({ label }: { label: string }) {
  const { open, toggle } = useContext(FilterPanelContext);
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={LISTING_FILTERS_ID}
      onClick={toggle}
      className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-bg px-3.5 text-sm font-semibold md:hidden"
    >
      <Icon name="filter" className="size-4" />
      {label}
    </button>
  );
}

/** The sidebar: hidden below 900px until the toggle opens it, always shown (and sticky) from 900px. */
export function ListingFilterPanel({ label, children }: { label: string; children: ReactNode }) {
  const { open } = useContext(FilterPanelContext);
  return (
    <aside
      id={LISTING_FILTERS_ID}
      aria-label={label}
      className={`${open ? 'block' : 'hidden'} min-w-0 rounded-(--radius) bg-bg px-4 pt-1 pb-4 md:sticky md:top-24 md:block`}
    >
      {children}
    </aside>
  );
}
