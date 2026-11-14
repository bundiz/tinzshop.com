import { useTranslations } from 'next-intl';
import ProductBadge from '@/components/domain/ProductBadge';
import { platformTone } from '@/components/domain/platform-tone';
import type { ProductDetailCategory } from '@/server/services/catalogue/product-detail-service';

export type ProductHeadingProps = {
  name: string;
  isKit: boolean;
  isPreOrder: boolean;
  /** Shown beside the pre-order badge, formatted by the message (D-118). */
  releaseDate: Date | null;
  /** The platform tag, in the platform's tone; no tag without a platform. */
  platform: ProductDetailCategory | null;
  productType: ProductDetailCategory | null;
};

/**
 * The top of the buy box: the platform tag, the kit and pre-order badges and the title (the mockup's `.buy`
 * head). The platform and type come from the breadcrumb data (D-151).
 */
export default function ProductHeading({ name, isKit, isPreOrder, releaseDate, platform, productType }: ProductHeadingProps) {
  const t = useTranslations('shop.product');
  const hasBadges = isKit || isPreOrder;
  return (
    <>
      {platform !== null && (
        <p>
          <ProductBadge tone={platformTone(platform.slug)}>
            {productType !== null ? t('platformTag', { platform: platform.name, type: productType.name }) : platform.name}
          </ProductBadge>
        </p>
      )}
      {hasBadges && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {isKit && <ProductBadge tone="bundle">{t('badge.bundle')}</ProductBadge>}
          {isPreOrder && <ProductBadge tone="preOrder">{t('badge.preOrder')}</ProductBadge>}
          {isPreOrder && releaseDate !== null && (
            <span className="text-xs font-semibold text-warn">{t('releaseDate', { date: releaseDate })}</span>
          )}
        </p>
      )}
      <h1
        id="product-title"
        className="mt-2.5 text-[clamp(26px,2.6vw,34px)] font-bold [overflow-wrap:anywhere]"
      >
        {name}
      </h1>
    </>
  );
}
