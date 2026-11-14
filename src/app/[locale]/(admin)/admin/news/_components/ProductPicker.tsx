'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';

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
 * A search box over the active products (name or SKU) with its results. Choosing one calls `onPick`. Typing waits a moment
 * before it asks, and an answer that arrives after a newer question is ignored. Used by the side panel and by the toolbar's
 * product-card dialog.
 */
export function ProductSearchBox({ search, onPick, exclude = [], autoFocus = false }: { search: ProductSearch; onPick: (hit: ProductPickerHit) => void; exclude?: readonly string[]; autoFocus?: boolean }) {
  const t = useTranslations('admin.news.editor');
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ProductPickerHit[] | null>(null);

  useEffect(() => {
    const text = query.trim();
    if (text === '') {
      // Nothing typed: no results to show.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the list when the box is emptied
      setHits(null);
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      search(text).then(
        (found) => {
          if (current) setHits(found);
        },
        () => {
          if (current) setHits([]);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, search]);

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
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          // Enter in the box must not submit the article.
          if (event.key === 'Enter') event.preventDefault();
        }}
        placeholder={t('productsPlaceholder')}
        className="min-h-11 w-full rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-ink"
      />
      {hits !== null ? (
        shown.length === 0 ? (
          <p role="status" className="mt-2 text-sm text-muted">
            {t('productsNone')}
          </p>
        ) : (
          <ul className="mt-2 grid gap-1">
            {shown.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  aria-label={t('productsAdd', { name: hit.name })}
                  onClick={() => onPick(hit)}
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
 * "Related products" (the mockup's `.relp`): the chosen products with a remove button each (and a hidden `productId`
 * field each), and the search box that adds more. The article will show on those product pages.
 */
export default function ProductPicker({ selected, onChange, search }: ProductPickerProps) {
  const t = useTranslations('admin.news.editor');
  return (
    <div>
      <p className="mb-2.5 text-[13.5px] text-muted">{t('productsHint')}</p>
      {selected.length > 0 ? (
        <ul className="mb-2.5 grid gap-1.5">
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
                className="grid size-11 flex-none cursor-pointer place-items-center rounded-sm text-ink-2 hover:bg-sunk"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <ProductSearchBox search={search} exclude={selected.map((hit) => hit.id)} onPick={(hit) => onChange([...selected, hit])} />
    </div>
  );
}
