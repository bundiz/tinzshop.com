'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import PriceDisplay from '@/components/domain/PriceDisplay';
import StockBadge from '@/components/domain/StockBadge';
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
        <div className="mt-3.5 rounded-(--radius) bg-[linear-gradient(90deg,#fff4dc_0%,#fffaf0_100%)] px-4 py-3.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <PriceDisplay satang={chosen.priceSatang} original={chosen.originalPriceSatang} size="buyBox" />
            <StockBadge status={chosen.stockStatus} />
          </div>
          <p className="mt-1 text-xs text-text-muted">{t('vatNote')}</p>
        </div>
      )}
      {optionTypes.map((type) => {
        const current = type.values.find((value) => value.id === selection[type.id]);
        return (
          <fieldset key={type.id} className="mt-4 min-w-0 border-0 p-0">
            <legend className="mb-2 p-0 text-sm text-text-muted [&_strong]:text-text">
              {current !== undefined
                ? t.rich('option.selected', {
                    name: type.name,
                    value: current.value,
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })
                : type.name}
            </legend>
            <div className="flex flex-wrap gap-2">
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
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-(--radius-sm) border-[1.5px] border-border bg-bg px-3.5 text-sm [overflow-wrap:anywhere] hover:border-[#9ebdf0] peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:font-semibold peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-not-allowed peer-disabled:bg-bg-subtle peer-disabled:text-text-subtle peer-disabled:line-through"
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
    </>
  );
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
