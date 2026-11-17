'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import Icon from '@/components/ui/Icon';
import { selectChevronClass, selectTriggerClass } from '@/components/ui/Select';
import { useAnchoredPopup } from '@/components/ui/use-anchored-popup';
import type { ProductPickerHit } from '@/server/services/catalogue/product-search-service';

export type ProductSearch = (query: string) => Promise<ProductPickerHit[]>;

const DEBOUNCE_MS = 250;

function Thumb({ hit }: { hit: ProductPickerHit }) {
  return hit.imageUrl === null ? (
    <span aria-hidden="true" className="size-10 flex-none rounded-sm bg-sunk" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- Shopee image URL, no image pipeline yet
    <img src={hit.imageUrl} alt="" width={40} height={40} className="size-10 flex-none rounded-sm bg-sunk object-cover" />
  );
}

/**
 * A search box over the active products (name or SKU) with its results, up to twenty (the service's limit), for the
 * toolbar's card dialog. Choosing one calls `onPick`. Typing waits a moment before it asks, and an answer that arrives
 * after a newer question is ignored. With `browse` (D-269) it lists the first products as soon as it shows, in a list that
 * scrolls; without it, it waits for typing.
 */
export function ProductSearchBox({
  search,
  onPick,
  exclude = [],
  autoFocus = false,
  browse = false,
}: {
  search: ProductSearch;
  onPick: (hit: ProductPickerHit) => void;
  exclude?: readonly string[];
  autoFocus?: boolean;
  browse?: boolean;
}) {
  const t = useTranslations('admin.news.editor');
  const inputId = useId();
  const [query, setQuery] = useState('');
  const hits = useProductSearch(search, query, true, browse);
  const shown = (hits ?? []).filter((hit) => !exclude.includes(hit.id));
  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        {t('productsSearch')}
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          // Enter in the box must not submit the article.
          if (event.key === 'Enter') event.preventDefault();
        }}
        placeholder={t('productsPlaceholder')}
        className="min-h-11 w-full rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-ink"
      />
      {hits === null ? null : shown.length === 0 ? (
        <p role="status" className="mt-2 text-sm text-muted">
          {t('productsNone')}
        </p>
      ) : (
        <ul className={`mt-2 grid grid-cols-1 gap-1${browse ? ' max-h-[min(360px,50vh)] overflow-y-auto overscroll-contain rounded-sm border border-line p-1' : ''}`}>
          {shown.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                aria-label={t('productsAdd', { name: hit.name })}
                onClick={() => onPick(hit)}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm p-1.5 text-left hover:bg-sunk"
              >
                <HitText hit={hit} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Asks `search` for `query` while `active`, and returns the answer (`null` before the first one, or when there is nothing
 * to ask). An empty query asks at once when `listsWhenEmpty`, and otherwise asks nothing; typing waits a moment. An answer
 * that arrives after a newer question is ignored; a failed one shows as no results.
 */
function useProductSearch(search: ProductSearch, query: string, active: boolean, listsWhenEmpty: boolean): ProductPickerHit[] | null {
  const [hits, setHits] = useState<ProductPickerHit[] | null>(null);
  useEffect(() => {
    const text = query.trim();
    if (!active || (text === '' && !listsWhenEmpty)) {
      // Nothing to ask: no results to show.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the list when the box is emptied or closed
      setHits(null);
      return;
    }
    let current = true;
    // The first list (nothing typed yet) comes at once; typing waits a moment.
    const timer = setTimeout(
      () => {
        search(text).then(
          (found) => {
            if (current) setHits(found);
          },
          () => {
            if (current) setHits([]);
          },
        );
      },
      text === '' ? 0 : DEBOUNCE_MS,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, search, active, listsWhenEmpty]);
  return hits;
}

/** A product row's thumb, name and SKU. */
function HitText({ hit }: { hit: ProductPickerHit }) {
  return (
    <>
      <Thumb hit={hit} />
      <span className="min-w-0">
        <b className="block truncate text-sm font-semibold text-ink">{hit.name}</b>
        <small className="block text-[12.5px] text-muted">{hit.sku}</small>
      </span>
    </>
  );
}

/** The popup's tallest: the search box and about six rows; it scrolls inside beyond that. */
const POPUP_MAX_HEIGHT = 360;

/**
 * The related-products panel's picker (D-271): a trigger that looks like a `Select` (`md`) with a muted "choose a product"
 * and a chevron, opening a popup with a search box at its top and the products under it — the first twenty before
 * anything is typed (the chosen ones left out), narrowed as you type. The popup is drawn in a portal with fixed
 * positioning, below the trigger or above it when it does not fit (`useAnchoredPopup`), so it never makes the page taller.
 * Keys: Enter, Space or ArrowDown on the trigger open it and focus the search box (a `combobox` whose
 * `aria-activedescendant` is the active option); ArrowDown and ArrowUp move; Enter picks; Escape closes; Tab closes and
 * moves on from the trigger. A pick or Escape returns focus to the trigger; a press outside closes it and leaves focus
 * where the press put it.
 */
function ProductCombobox({ search, onPick, exclude }: { search: ProductSearch; onPick: (hit: ProductPickerHit) => void; exclude: readonly string[] }) {
  const t = useTranslations('admin.news.editor');
  const baseId = useId();
  const inputId = `${baseId}-search`;
  const listId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const hits = useProductSearch(search, query, open, true);
  const shown = (hits ?? []).filter((hit) => !exclude.includes(hit.id));
  // A new answer starts with no active option.
  const [answered, setAnswered] = useState(hits);
  if (answered !== hits) {
    setAnswered(hits);
    setActiveIndex(-1);
  }
  const active = activeIndex >= 0 && activeIndex < shown.length ? activeIndex : -1;

  useAnchoredPopup({ open, anchorRef: trigger, popupRef: popup, maxHeight: POPUP_MAX_HEIGHT, sizeToMax: true });

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
    if (refocus) trigger.current?.focus();
  }, []);

  // The search box takes focus as the popup opens (after it is placed, so the page does not jump).
  useLayoutEffect(() => {
    if (open) input.current?.focus({ preventScroll: true });
  }, [open]);

  // Keep the active option in view.
  useLayoutEffect(() => {
    const box = list.current;
    const option = active >= 0 ? box?.querySelector<HTMLElement>(`[data-index="${active}"]`) : null;
    if (box === null || option === null || option === undefined) return;
    if (option.offsetTop < box.scrollTop) box.scrollTop = option.offsetTop - 4;
    else if (option.offsetTop + option.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = option.offsetTop + option.offsetHeight - box.clientHeight + 4;
    }
  }, [active]);

  // A press outside the trigger and the popup closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && !(trigger.current?.contains(target) ?? false) && !(popup.current?.contains(target) ?? false)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  const pick = (hit: ProductPickerHit) => {
    onPick(hit);
    close(true);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={t('productsChoose')}
        onClick={() => {
          if (open) close(true);
          else setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!open && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        // Space opens on keydown; stop the button's own Space click on keyup.
        onKeyUp={(event) => {
          if (event.key === ' ') event.preventDefault();
        }}
        className={selectTriggerClass('md', 'w-full')}
      >
        <span className="min-w-0 flex-1 truncate text-muted">{t('productsChoose')}</span>
        <Icon name="chevDown" className={selectChevronClass('md', open)} />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popup}
              data-product-combobox-popup=""
              style={{ position: 'fixed', maxHeight: POPUP_MAX_HEIGHT }}
              className="z-80 flex w-[min(360px,calc(100vw-16px))] flex-col rounded-md border border-line bg-surface p-2 shadow-1"
            >
              {/* The search box and the rows share the popup's inner padding, so their edges line up; a line under the box. */}
              <div className="w-full flex-none border-b border-line pb-2">
              <label htmlFor={inputId} className="sr-only">
                {t('productsSearch')}
              </label>
              <input
                ref={input}
                id={inputId}
                type="search"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? optionId(active) : undefined}
                value={query}
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  switch (event.key) {
                    case 'ArrowDown':
                      event.preventDefault();
                      if (shown.length > 0) setActiveIndex(Math.min(active + 1, shown.length - 1));
                      return;
                    case 'ArrowUp':
                      event.preventDefault();
                      if (shown.length > 0) setActiveIndex(Math.max(active - 1, 0));
                      return;
                    case 'Enter': {
                      // Enter must never submit the article.
                      event.preventDefault();
                      const hit = active >= 0 ? shown[active] : undefined;
                      if (hit !== undefined) pick(hit);
                      return;
                    }
                    case 'Escape':
                      event.preventDefault();
                      // A dialog around the picker must not close with it.
                      event.stopPropagation();
                      close(true);
                      return;
                    case 'Tab':
                      // Focus goes back to the trigger first, so Tab moves on from there, not off the end of the page.
                      close(true);
                      return;
                    default:
                  }
                }}
                placeholder={t('productsPlaceholder')}
                // The focus ring is drawn inside the box (the site's ring sits 2px outside and would stick out of the popup).
                className="block min-h-11 w-full min-w-0 rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-ink focus:border-ink focus-visible:outline-2 focus-visible:-outline-offset-2"
              />
              </div>
              {hits === null ? null : shown.length === 0 ? (
                <p role="status" className="px-1.5 pt-3 pb-1 text-sm text-muted">
                  {t('productsNone')}
                </p>
              ) : null}
              <ul
                ref={list}
                id={listId}
                role="listbox"
                aria-label={t('productsChoose')}
                // Keep focus in the search box when the list or its scrollbar is pressed.
                onMouseDown={(event) => event.preventDefault()}
                className="mt-2 grid min-h-0 w-full flex-1 grid-cols-1 gap-0.5 overflow-y-auto overscroll-contain empty:hidden"
              >
                {shown.map((hit, index) => (
                  <li
                    key={hit.id}
                    id={optionId(index)}
                    data-index={index}
                    role="option"
                    aria-selected={index === active}
                    onPointerMove={() => {
                      if (active !== index) setActiveIndex(index);
                    }}
                    onClick={() => pick(hit)}
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm p-1.5 ${index === active ? 'bg-sunk' : ''}`}
                  >
                    <HitText hit={hit} />
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export type ProductPickerProps = {
  selected: ProductPickerHit[];
  onChange: (selected: ProductPickerHit[]) => void;
  search: ProductSearch;
};

/**
 * "Related products" (the mockup's `.relp`): the select-style picker that adds products (`ProductCombobox`, D-271), then the chosen ones
 * with a remove button each (and a hidden `productId` field each). The article will show on those product pages.
 */
export default function ProductPicker({ selected, onChange, search }: ProductPickerProps) {
  const t = useTranslations('admin.news.editor');
  return (
    <div>
      <p className="mb-2.5 text-[13.5px] text-muted">{t('productsHint')}</p>
      {/* The picker first; the chosen products under it (owner, 2026-11-17, D-270, D-271). */}
      <ProductCombobox search={search} exclude={selected.map((hit) => hit.id)} onPick={(hit) => onChange([...selected, hit])} />
      {selected.length > 0 ? (
        <ul className="mt-2.5 grid grid-cols-1 gap-1.5">
          {selected.map((hit) => (
            <li key={hit.id} className="flex items-center gap-2.5">
              <Thumb hit={hit} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm font-semibold text-ink">{hit.name}</b>
                <small className="block text-[12.5px] text-muted">{hit.sku}</small>
              </span>
              <input type="hidden" name="productId" value={hit.id} />
              <button
                type="button"
                aria-label={t('productsRemove', { name: hit.name })}
                onClick={() => onChange(selected.filter((entry) => entry.id !== hit.id))}
                className="grid size-11 flex-none cursor-pointer place-items-center rounded-sm text-ink-2 transition-colors hover:bg-sunk hover:text-ink sm:size-9"
              >
                <Icon name="x" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
