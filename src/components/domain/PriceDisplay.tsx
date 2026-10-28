import { useLocale, useTranslations } from 'next-intl';

export type PriceDisplayProps = {
  /** The price in satang (D-010); this component is the only place it becomes baht. */
  satang: bigint;
  /** The pre-discount price in satang, shown struck through when given (only when above `satang`). */
  original?: bigint | null;
  /** True when the product's variants differ in price: `satang` is then the lowest. */
  isRange?: boolean;
  /** `card` on product cards; `buyBox` is the product page's large price. */
  size?: 'card' | 'buyBox';
};

const NOW_CLASS: Record<NonNullable<PriceDisplayProps['size']>, string> = {
  card: 'text-[18px] leading-[1.3] font-extrabold text-text',
  buyBox: 'text-[30px] leading-[1.25] font-extrabold text-primary',
};

const ORIGINAL_CLASS: Record<NonNullable<PriceDisplayProps['size']>, string> = {
  card: 'text-[13px] text-text-subtle',
  buyBox: 'text-[15px] text-text-subtle',
};

/** The only component that renders a price (07 Money, dates and numbers). */
export default function PriceDisplay({ satang, original = null, isRange = false, size = 'card' }: PriceDisplayProps) {
  const locale = useLocale();
  const t = useTranslations('shop.product.price');
  const now = formatBaht(satang, locale);

  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={NOW_CLASS[size]}>
        {isRange ? t('from', { price: now }) : now}
      </span>
      {original !== null && (
        <s className={ORIGINAL_CLASS[size]}>
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
