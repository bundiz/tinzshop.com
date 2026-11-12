'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import PriceDisplay from '@/components/domain/PriceDisplay';
import StockBadge from '@/components/domain/StockBadge';
import { buttonClass } from '@/components/ui/button-class';
import Icon from '@/components/ui/Icon';
import type { ProductDetail, ProductDetailVariant } from '@/server/services/catalogue/product-detail-service';

export type VariantPickerProps = {
  optionTypes: ProductDetail['optionTypes'];
  /** Active variants only. */
  variants: ProductDetailVariant[];
  defaultVariantId: string;
};

/** Option type id → chosen option value id. */
type Selection = Record<string, string>;

/**
 * The buy box's price, stock status and option choices (REQ-003, D-121). A value
 * no active variant carries is disabled. Picking a value with no active variant
 * under the other current choices moves those choices to the best active variant
 * carrying it, so every active variant can be reached. A value whose variant is
 * sold out stays selectable and says so.
 */
export default function VariantPicker({ optionTypes, variants, defaultVariantId }: VariantPickerProps) {
  const t = useTranslations('shop.product');
  const idPrefix = useId();
  const fallback = variants.find((variant) => variant.variantId === defaultVariantId) ?? variants[0];
  const [selection, setSelection] = useState<Selection>(() => selectionOf(optionTypes, fallback));
  const chosen = findVariant(variants, optionTypes, selection) ?? fallback;

  return (
    <>
      {chosen !== undefined && (
        <div className="mt-5 rounded-lg border border-line bg-surface p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <PriceDisplay satang={chosen.priceSatang} original={chosen.originalPriceSatang} size="buyBox" />
            <StockBadge status={chosen.stockStatus} />
          </div>
          <p className="mt-2.5 flex items-center gap-2.5 text-[15px] text-ink-2">
            <Icon name="card" className="size-5 flex-none" />
            <span>{t('vatNote')}</span>
          </p>
        </div>
      )}
      {optionTypes.map((type) => {
        const current = type.values.find((value) => value.id === selection[type.id]);
        return (
          <fieldset key={type.id} className="mt-[22px] min-w-0 border-0 p-0">
            <legend className="mb-2.5 p-0 font-semibold [&_strong]:font-normal [&_strong]:text-muted">
              {current !== undefined
                ? t.rich('option.selected', {
                    name: type.name,
                    value: current.value,
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })
                : type.name}
            </legend>
            <div className="flex flex-wrap gap-2.5">
              {type.values.map((value) => {
                const variant = variantForPick(variants, optionTypes, selection, type.id, value.id);
                const inputId = `${idPrefix}-${value.id}`;
                return (
                  <span key={value.id} className="contents">
                    <input
                      type="radio"
                      id={inputId}
                      name={`${idPrefix}-${type.id}`}
                      value={value.id}
                      checked={selection[type.id] === value.id}
                      disabled={variant === undefined}
                      onChange={() => setSelection(selectValue(optionTypes, variants, selection, type.id, value.id))}
                      className="peer sr-only"
                    />
                    <label
                      htmlFor={inputId}
                      className="inline-flex min-h-12 cursor-pointer items-center rounded-sm border-[1.5px] border-line-2 bg-surface px-4 font-medium transition-[border-color,box-shadow] duration-[180ms] [overflow-wrap:anywhere] hover:border-ink-2 peer-checked:border-ink peer-checked:shadow-[inset_0_0_0_1px_var(--color-ink)] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ps peer-disabled:cursor-not-allowed peer-disabled:border-dashed peer-disabled:text-muted"
                    >
                      {variant?.stockStatus === 'out_of_stock' ? t('option.soldOut', { value: value.value }) : value.value}
                    </label>
                  </span>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {chosen !== undefined && (
        <div
          data-buy-bar=""
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-white px-[clamp(16px,3.2vw,32px)] py-2.5 shadow-[0_-8px_24px_-12px_rgba(0,0,0,.15)] sm:hidden"
        >
          <div className="min-w-0">
            <small className="block text-[12.5px] text-muted [overflow-wrap:anywhere]">{chosenLabel(optionTypes, chosen)}</small>
            <PriceDisplay satang={chosen.priceSatang} original={null} size="card" />
          </div>
          <button type="button" className={buttonClass({ variant: 'buy' })}>
            {t('buyNow')}
          </button>
        </div>
      )}
    </>
  );
}

/** The chosen variant's option values, as the buy bar's small line ("1TB · Black"). */
function chosenLabel(optionTypes: VariantPickerProps['optionTypes'], variant: ProductDetailVariant): string {
  return optionTypes
    .map((type) => type.values.find((value) => variant.optionValueIds.includes(value.id))?.value)
    .filter((value): value is string => value !== undefined)
    .join(' · ');
}

function selectionOf(optionTypes: VariantPickerProps['optionTypes'], variant: ProductDetailVariant | undefined): Selection {
  const selection: Selection = {};
  for (const type of optionTypes) {
    const value = type.values.find((candidate) => variant?.optionValueIds.includes(candidate.id));
    if (value !== undefined) selection[type.id] = value.id;
  }
  return selection;
}

/**
 * The selection after the customer picks `valueId` for `typeId`: the other
 * choices are kept when an active variant matches them, otherwise they move to
 * that variant's values.
 */
export function selectValue(
  optionTypes: VariantPickerProps['optionTypes'],
  variants: ProductDetailVariant[],
  selection: Selection,
  typeId: string,
  valueId: string,
): Selection {
  const target = variantForPick(variants, optionTypes, selection, typeId, valueId);
  return target === undefined ? { ...selection, [typeId]: valueId } : selectionOf(optionTypes, target);
}

/**
 * The variant picking `valueId` lands on: the one matching it with the other
 * current choices, else the best active variant carrying it — in stock first,
 * then cheapest, then first in Shopee's order. Undefined when no active variant
 * carries the value, which is what disables it.
 */
function variantForPick(
  variants: ProductDetailVariant[],
  optionTypes: VariantPickerProps['optionTypes'],
  selection: Selection,
  typeId: string,
  valueId: string,
): ProductDetailVariant | undefined {
  const exact = findVariant(variants, optionTypes, { ...selection, [typeId]: valueId });
  if (exact !== undefined) return exact;
  return variants
    .filter((variant) => variant.optionValueIds.includes(valueId))
    .reduce<ProductDetailVariant | undefined>((best, variant) => (best === undefined || isBetter(variant, best) ? variant : best), undefined);
}

function isBetter(a: ProductDetailVariant, b: ProductDetailVariant): boolean {
  const aInStock = a.stockStatus === 'in_stock';
  if (aInStock !== (b.stockStatus === 'in_stock')) return aInStock;
  return a.priceSatang < b.priceSatang;
}

/** The active variant carrying exactly the selected value of every option type, if there is one. */
function findVariant(
  variants: ProductDetailVariant[],
  optionTypes: VariantPickerProps['optionTypes'],
  selection: Selection,
): ProductDetailVariant | undefined {
  const wanted = optionTypes.map((type) => selection[type.id]);
  if (wanted.some((id) => id === undefined)) return undefined;
  return variants.find(
    (variant) =>
      variant.optionValueIds.length === wanted.length && wanted.every((id) => variant.optionValueIds.includes(id as string)),
  );
}
