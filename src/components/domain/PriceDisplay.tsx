import { useLocale, useTranslations } from 'next-intl';

export type PriceDisplayProps = {
  /** The price in satang (D-010); this component is the only place it becomes baht. */
  satang: bigint;
  /** The pre-discount price in satang, shown struck through when given (only when above `satang`). */
  original?: bigint | null;
  /** True when the product's variants differ in price: `satang` is then the lowest. */
  isRange?: boolean;
  /**
   * `card` on product cards, `buyBox` the product page's large price, `feature` the hero card's price on
   * navy, `mini` the hero's small rows.
   */
  size?: 'card' | 'buyBox' | 'feature' | 'mini';
};

const NOW_CLASS: Record<NonNullable<PriceDisplayProps['size']>, string> = {
  card: 'font-head text-lg font-bold sm:text-xl',
  buyBox: 'font-head text-[36px] font-bold',
  feature: 'font-head text-[26px] font-bold',
  mini: 'font-body text-[13px] font-normal',
};

// On navy (the hero's feature card and minis) the grey would not read, so the original takes the on-navy grey.
const ORIGINAL_CLASS = 'text-sm text-muted line-through';
const ORIGINAL_ON_NAVY_CLASS = 'text-sm text-on-navy-2 line-through';

// The red sale price is 2.65:1 on the navy card, below the 3:1 a large heading needs, so on navy a sale is told by
// the struck original alone and the price stays white (plan 015 Task 4).
const onNavy = (size: NonNullable<PriceDisplayProps['size']>) => size === 'feature' || size === 'mini';

/** The only component that renders a price (07 Money, dates and numbers). */
export default function PriceDisplay({ satang, original = null, isRange = false, size = 'card' }: PriceDisplayProps) {
  const locale = useLocale();
  const t = useTranslations('shop.product.price');
  const now = formatBaht(satang, locale);
  // The sale look (red price, struck original) only when the original is above the price (D-123).
  const onSale = original !== null && original > satang;

  const colour = onNavy(size) ? (size === 'feature' ? 'text-white' : '') : onSale ? 'text-sale' : '';

  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
      <span className={[NOW_CLASS[size], colour].filter(Boolean).join(' ')}>
        {isRange ? t('from', { price: now }) : now}
      </span>
      {onSale && (
        <s className={onNavy(size) ? ORIGINAL_ON_NAVY_CLASS : ORIGINAL_CLASS}>
          {/* Strikethrough is not announced, so a screen reader hears what the number is. */}
          <span className="sr-only">{t('original')}</span> {formatBaht(original, locale)}
        </s>
      )}
    </p>
  );
}

function formatBaht(satang: bigint, locale: string): string {
  // Whole-baht prices show no decimals, as the design does; any satang shows two.
  const digits = satang % 100n === 0n ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'THB',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(satang) / 100);
}
