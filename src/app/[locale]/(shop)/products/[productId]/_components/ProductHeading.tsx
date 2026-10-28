import { useTranslations } from 'next-intl';
import ProductBadge from '@/components/domain/ProductBadge';

/** The product title with the ชุดโปรโมชั่น badge beside it when the product is a Shopee kit item. */
export default function ProductHeading({ name, isKit }: { name: string; isKit: boolean }) {
  const t = useTranslations('shop.product');
  return (
    <>
      {isKit && (
        <p className="mb-2">
          <ProductBadge tone="bundle">{t('badge.bundle')}</ProductBadge>
        </p>
      )}
      <h1 id="product-title" className="text-[22px] leading-[1.5] [overflow-wrap:anywhere]">
        {name}
      </h1>
    </>
  );
}
