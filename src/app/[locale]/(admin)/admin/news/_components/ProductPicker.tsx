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

/** A product's image, or its first letter on a plain square when it has none. */
function Thumb({ hit }: { hit: ProductPickerHit }) {
  return hit.imageUrl === null ? (
    <span aria-hidden="true" data-product-initial="" className="grid size-10 flex-none place-items-center rounded-sm bg-sunk text-sm font-semibold text-ink-2">
      {[...hit.name.trim()][0]?.toLocaleUpperCase() ?? ''}
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- Shopee image URL, no image pipeline yet
    <img src={hit.imageUrl} alt="" width={40} height={40} className="size-10 flex-none rounded-sm bg-sunk object-cover" />
  );
}

/**
 * Asks `search` for `query` while `active`, and returns the answer (`null` before the first one, or while closed). An empty
 * query (the first twenty products, D-269) asks at once; typing waits a moment. An answer that arrives after a newer
 * question is ignored; a failed one shows as no results.
 */
function useProductSearch(search: ProductSearch, query: string, active: boolean): ProductPickerHit[] | null {
  const [hits, setHits] = useState<ProductPickerHit[] | null>(null);
  useEffect(() => {
    const text = query.trim();
    if (!active) {
      // Closed: no results to show.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the list when the popup closes
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
  }, [query, search, active]);
  return hits;
}

/** A product row's thumb, name and SKU. */
function HitText({ hit }: { hit: ProductPickerHit }) {
  return (
    <>
      <Thumb hit={hit} />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-sm font-semibold text-ink">{hit.name}</b>
        <small className="block text-[12.5px] text-muted">{hit.sku}</small>
      </span>
    </>
  );
}

/** The popup's tallest: the search box and about six rows; it scrolls inside beyond that. */
const POPUP_MAX_HEIGHT = 360;

/**
 * The news editor's product picker (D-271, D-272), in the related-products panel and the product-card dialog: a trigger
 * that looks like a `Select` (`md`) with a muted "choose a product" and a chevron, opening a popup whose top row is a
 * magnifier and a borderless search box, then a full-width line, then the products — the first twenty before anything is
 * typed (any in `exclude` left out), narrowed as you type. The popup is drawn in a portal with fixed positioning, below the
 * trigger or above it when it does not fit (`useAnchoredPopup`), so it never makes the page taller. Inside a modal dialog
 * (`aria-modal`) it is portalled into the dialog, so it stays inside the modal for a screen reader and for the dialog's
 * focus trap, and a press on it is a press inside the dialog; elsewhere into `document.body`.
 * Keys: Enter, Space or ArrowDown on the trigger open it and focus the search box (a `combobox` whose
 * `aria-activedescendant` is the active option); ArrowDown and ArrowUp move; Enter picks; Escape closes; Tab closes and
 * moves on from the trigger. A pick or Escape returns focus to the trigger; a press outside closes it and leaves focus
 * where the press put it.
 */
export function ProductCombobox({
  search,
  onPick,
  exclude = [],
}: {
  search: ProductSearch;
  onPick: (hit: ProductPickerHit) => void;
  exclude?: readonly string[];
}) {
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
  // Where the popup is drawn: the modal dialog around the trigger, if any, else the page's body; found as it opens.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const show = () => {
    setHost(trigger.current?.closest<HTMLElement>('[aria-modal="true"]') ?? document.body);
    setOpen(true);
  };
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const hits = useProductSearch(search, query, open);
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
          else show();
        }}
        onKeyDown={(event) => {
          if (!open && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
            event.preventDefault();
            show();
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
      {open && host !== null
        ? createPortal(
            <div
              ref={popup}
              data-product-combobox-popup=""
              style={{ position: 'fixed', maxHeight: POPUP_MAX_HEIGHT }}
              className="z-80 flex w-[min(360px,calc(100vw-16px))] flex-col overflow-hidden rounded-md border border-line bg-surface p-0 shadow-1"
            >
              {/* The search row is the field: a magnifier and a borderless box across the popup, a full-width line under it. */}
              <div className="flex w-full flex-none items-center gap-2.5 border-b border-line px-3.5">
                <Icon name="search" className="size-[18px] flex-none text-muted" />
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
                  // No box and no ring: the open popup already shows where focus is (owner, 2026-11-17, D-272).
                  className="block min-h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-ink placeholder:text-muted focus-visible:outline-none"
                />
              </div>
              {hits === null ? null : shown.length === 0 ? (
                <p role="status" className="px-3.5 py-3 text-sm text-muted">
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
                className="grid min-h-0 w-full flex-1 grid-cols-1 gap-0.5 overflow-y-auto overscroll-contain p-1.5 empty:hidden"
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
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 ${index === active ? 'bg-sunk' : ''}`}
                  >
                    <HitText hit={hit} />
                  </li>
                ))}
              </ul>
            </div>,
            host,
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
