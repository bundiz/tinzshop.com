import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import ImagePlaceholder from '@/components/domain/ImagePlaceholder';
import ProductBadge from '@/components/domain/ProductBadge';
import PriceDisplay from '@/components/domain/PriceDisplay';
import StockBadge from '@/components/domain/StockBadge';
import Icon from '@/components/ui/Icon';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';

export type ProductCardProps = {
  card: LandingProductCard;
  /** `grid` (default) stacks the image over the text; `list` sets them side by side (the listing's list view). */
  layout?: 'grid' | 'list';
};

/**
 * One product as a card (the mockup's `.card`, R11/D-196): image, tags, the wishlist heart, name, price, stock
 * status and the cart button, linking to its product page. The heart and the cart button are inert until a
 * wishlist and a cart exist (D-124). No category line (categories are a keyword mock, D-143), no instalment
 * line and no rating (spec O-6).
 */
export default function ProductCard({ card, layout = 'grid' }: ProductCardProps) {
  const t = useTranslations('shop.product');
  const locale = useLocale();
  const isOut = card.stockStatus === 'out_of_stock';
  const isList = layout === 'list';
  // The sale tag and red price only when the original is above the price (D-123).
  const isSale = card.originalPriceSatang !== null && card.originalPriceSatang > card.priceSatang;

  return (
    // The name's link stretches over the whole card, and the card draws the link's focus ring (07 Accessibility).
    <article
      className={`group relative flex h-full ${isList ? 'flex-row gap-3' : 'flex-col'} rounded-[14px] border border-line bg-surface p-2 transition-[transform,box-shadow,border-color] duration-[220ms] ease-soft hover:-translate-y-0.5 hover:border-transparent hover:shadow-2 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ps sm:rounded-lg sm:p-3`}
    >
      {(isSale || card.isKit || card.isPreOrder) && (
        <div className="absolute top-3.5 left-3.5 z-[2] flex flex-wrap gap-1.5 sm:top-5 sm:left-5">
          {isSale && <ProductBadge tone="sale">{t('badge.sale')}</ProductBadge>}
          {card.isKit && <ProductBadge tone="bundle">{t('badge.bundle')}</ProductBadge>}
          {card.isPreOrder && <ProductBadge tone="preOrder">{t('badge.preOrder')}</ProductBadge>}
        </div>
      )}
      <button
        type="button"
        aria-label={t('wishlist.addNamed', { name: card.name })}
        className="absolute top-3 right-3 z-[3] grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-white/92 text-ink shadow-1 transition-[transform,color] duration-[180ms] ease-soft hover:scale-[1.06] hover:text-sale sm:top-[18px] sm:right-[18px]"
      >
        <Icon name="heart" />
      </button>
      <div
        className={`${isList ? 'w-[120px] flex-none sm:w-[180px]' : ''} overflow-hidden rounded-md bg-surface ${isOut ? 'opacity-70 grayscale-[.9]' : ''}`}
      >
        {card.imageUrl !== null ? (
          // A plain <img>: the live Shopee image hosts are not known, so no next/image remote config.
          <img
            src={card.imageUrl}
            alt={card.name}
            loading="lazy"
            className="aspect-square w-full bg-surface object-contain transition-transform duration-[400ms] ease-soft group-hover:scale-[1.03]"
          />
        ) : (
          <ImagePlaceholder label={t('imagePlaceholderAlt')} />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-1 pt-3.5 pb-1">
        <h3 className="line-clamp-2 min-h-[2.9em] font-body text-[15px] leading-[1.45] font-semibold [overflow-wrap:anywhere] sm:text-base">
          <Link
            href={`/${locale}/product/${card.productId}/detail`}
            className="after:absolute after:inset-0 after:z-[2] after:rounded-[inherit] after:content-[''] focus-visible:outline-none"
          >
            {card.name}
          </Link>
        </h3>
        <div className="mt-auto pt-1.5">
          <PriceDisplay
            satang={card.priceSatang}
            original={card.originalPriceSatang}
            isRange={card.isPriceRange}
          />
        </div>
        {card.isPreOrder && card.releaseDate !== null && (
          <p className="text-xs font-semibold text-warn">{t('releaseDate', { date: card.releaseDate })}</p>
        )}
        <div className="flex min-h-11 items-center justify-between gap-2">
          <StockBadge status={card.stockStatus} />
          <button
            type="button"
            disabled={isOut}
            aria-label={isOut ? t('stock.out_of_stock') : t('addToCartNamed', { name: card.name })}
            className="relative z-[3] grid size-11 cursor-pointer place-items-center rounded-[10px] border-0 bg-brand text-white transition-[transform,background-color] duration-[180ms] ease-soft hover:-translate-y-px hover:bg-accent hover:text-ink active:scale-95 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-sunk disabled:text-muted"
          >
            <Icon name="cart" />
          </button>
        </div>
      </div>
    </article>
  );
}
