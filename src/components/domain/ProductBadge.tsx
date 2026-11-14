import type { PlatformTone } from '@/components/domain/platform-tone';

export type ProductBadgeProps = {
  /** `bundle` is the ชุดโปรโมชั่น (kit) badge, `preOrder` the pre-order one, `sale` the ลดราคา one; a platform tone tags a platform. */
  tone: 'bundle' | 'preOrder' | 'sale' | PlatformTone;
  children: string;
};

const TONE: Record<ProductBadgeProps['tone'], string> = {
  bundle: 'bg-accent text-ink',
  preOrder: 'bg-navy text-white',
  sale: 'bg-sale text-white',
  ps: 'bg-ps-soft text-ps-ink',
  ns: 'bg-ns-soft text-ns-ink',
  it: 'bg-it-soft text-it-ink',
  other: 'bg-sunk text-ink-2',
};

/** The small label on a product: a card's corner or the product page's title row (the mockup's `.tag`). */
export default function ProductBadge({ tone, children }: ProductBadgeProps) {
  return (
    <span
      className={`inline-flex h-[26px] items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] leading-none font-semibold whitespace-nowrap ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
