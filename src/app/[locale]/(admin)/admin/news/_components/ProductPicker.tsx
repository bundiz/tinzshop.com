'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

import Icon from '@/components/ui/Icon';
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
 * A search box over the active products (name or SKU) with its results, up to twenty (the service's limit). Choosing one
 * calls `onPick`. Typing waits a moment before it asks, and an answer that arrives after a newer question is ignored.
 * - `browse` (the toolbar's card dialog, D-269): lists the first products as soon as it shows, in a list that scrolls.
 * - `dropdown` (the related-products panel, D-270): the list opens only when the box is clicked or focused, floats over
 *   the page below the box, and closes on a pick, on Escape and on a press outside; the box is a `combobox`.
 */
export function ProductSearchBox({
  search,
  onPick,
  exclude = [],
  autoFocus = false,
  browse = false,
  dropdown = false,
}: {
  search: ProductSearch;
  onPick: (hit: ProductPickerHit) => void;
  exclude?: readonly string[];
  autoFocus?: boolean;
  browse?: boolean;
  dropdown?: boolean;
}) {
  const t = useTranslations('admin.news.editor');
  const inputId = useId();
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ProductPickerHit[] | null>(null);
  const [open, setOpen] = useState(false);
  // What to show: the dialog always; the dropdown only while open.
  const active = dropdown ? open : true;
  // An empty box lists products in the dialog and in an open dropdown; otherwise it waits for typing.
  const listsWhenEmpty = browse || dropdown;

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

  // A press outside the box and its list closes the dropdown.
  useEffect(() => {
    if (!dropdown || !open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [dropdown, open]);

  const pick = (hit: ProductPickerHit) => {
    onPick(hit);
    if (dropdown) {
      setOpen(false);
      setQuery('');
    }
  };

  const shown = (hits ?? []).filter((hit) => !exclude.includes(hit.id));
  const listClass = dropdown
    ? 'absolute inset-x-0 top-full z-30 mt-1 grid max-h-[min(320px,50vh)] grid-cols-1 gap-1 overflow-y-auto overscroll-contain rounded-md border border-line bg-surface p-1 shadow-1'
    : `mt-2 grid grid-cols-1 gap-1${browse ? ' max-h-[min(360px,50vh)] overflow-y-auto overscroll-contain rounded-sm border border-line p-1' : ''}`;
  return (
    <div ref={wrapper} className={dropdown ? 'relative' : undefined}>
      <label htmlFor={inputId} className="sr-only">
        {t('productsSearch')}
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        autoFocus={autoFocus}
        autoComplete="off"
        {...(dropdown ? { role: 'combobox', 'aria-expanded': open, 'aria-controls': listId, 'aria-haspopup': 'listbox' as const } : {})}
        onClick={dropdown ? () => setOpen(true) : undefined}
        onFocus={dropdown ? () => setOpen(true) : undefined}
        onChange={(event) => {
          setQuery(event.target.value);
          if (dropdown) setOpen(true);
        }}
        onKeyDown={(event) => {
          // Enter in the box must not submit the article.
          if (event.key === 'Enter') event.preventDefault();
          if (dropdown && event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
          }
        }}
        placeholder={t('productsPlaceholder')}
        className="min-h-11 w-full rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-ink"
      />
      {hits !== null && active ? (
        shown.length === 0 ? (
          <p role="status" className={dropdown ? 'absolute inset-x-0 top-full z-30 mt-1 rounded-md border border-line bg-surface p-3 text-sm text-muted shadow-1' : 'mt-2 text-sm text-muted'}>
            {t('productsNone')}
          </p>
        ) : (
          <ul id={listId} {...(dropdown ? { role: 'listbox' } : {})} className={listClass}>
            {shown.map((hit) => (
              <li key={hit.id} {...(dropdown ? { role: 'option', 'aria-selected': false } : {})}>
                <button
                  type="button"
                  aria-label={t('productsAdd', { name: hit.name })}
                  onClick={() => pick(hit)}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm p-1.5 text-left hover:bg-sunk"
                >
                  <Thumb hit={hit} />
                  <span className="min-w-0">
                    <b className="block truncate text-sm font-semibold text-ink">{hit.name}</b>
                    <small className="block text-[12.5px] text-muted">{hit.sku}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

export type ProductPickerProps = {
  selected: ProductPickerHit[];
  onChange: (selected: ProductPickerHit[]) => void;
  search: ProductSearch;
};

/**
 * "Related products" (the mockup's `.relp`): the search box that adds products (a dropdown, D-270), then the chosen ones
 * with a remove button each (and a hidden `productId` field each). The article will show on those product pages.
 */
export default function ProductPicker({ selected, onChange, search }: ProductPickerProps) {
  const t = useTranslations('admin.news.editor');
  return (
    <div>
      <p className="mb-2.5 text-[13.5px] text-muted">{t('productsHint')}</p>
      {/* The search first, as a dropdown that opens on click; the chosen products under it (owner, 2026-11-17, D-270). */}
      <ProductSearchBox search={search} dropdown exclude={selected.map((hit) => hit.id)} onPick={(hit) => onChange([...selected, hit])} />
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
