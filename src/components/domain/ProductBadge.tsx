export type ProductBadgeProps = {
  /** `bundle` is the ชุดโปรโมชั่น (kit) badge; `preOrder` the pre-order one. */
  tone: 'bundle' | 'preOrder';
  children: string;
};

/** The small label on a product: a card's corner or the product page's title row (design `badge`). */
export default function ProductBadge({ tone, children }: ProductBadgeProps) {
  const colour = tone === 'bundle' ? 'bg-text text-white' : 'bg-accent text-text';
  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-2 py-px text-xs leading-[1.6] font-semibold whitespace-nowrap ${colour}`}
    >
      {children}
    </span>
  );
}
