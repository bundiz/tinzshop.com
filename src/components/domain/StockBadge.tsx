import { useTranslations } from 'next-intl';

export type StockBadgeProps = {
  /** A status, never a quantity (REQ-006, D-024, D-065). */
  status: 'in_stock' | 'out_of_stock';
};

const COLOUR: Record<StockBadgeProps['status'], string> = {
  in_stock: 'text-ok',
  out_of_stock: 'text-muted',
};

/** The only component that renders availability: text plus colour, so colour is never the only signal. */
export default function StockBadge({ status }: StockBadgeProps) {
  const t = useTranslations('shop.product.stock');

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13.5px] font-medium before:size-2 before:rounded-full before:bg-current before:content-[''] ${COLOUR[status]}`}
    >
      {t(status)}
    </span>
  );
}
