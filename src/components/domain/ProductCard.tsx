import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import ImagePlaceholder from '@/components/domain/ImagePlaceholder';
import PriceDisplay from '@/components/domain/PriceDisplay';
import StockBadge from '@/components/domain/StockBadge';
import Icon from '@/components/ui/Icon';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';

export type ProductCardProps = {
  card: LandingProductCard;
};

/**
 * One product as a card: image, badges, the wishlist heart, name, price and stock status, linking to its
 * product page. The heart is inert until a wishlist exists (D-124). The design's category line is left out:
 * the mirror carries no category names yet. No rating (spec O-6).
 */
export default function ProductCard({ card }: ProductCardProps) {
  const t = useTranslations('shop.product');
  const locale = useLocale();
  const isOut = card.stockStatus === 'out_of_stock';

  return (
    // The name's link stretches over the whole card, and the card draws the link's focus ring (07 Accessibility).
    <article className="group relative flex h-full flex-col overflow-hidden rounded-(--radius) border border-border bg-bg shadow-card transition-[box-shadow,border-color,transform] duration-[180ms] hover:-translate-y-0.5 hover:border-[#cbdcf7] hover:shadow-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary">
      {(card.isKit || card.isPreOrder) && (
        <div className="absolute top-2 left-2 z-[1] flex flex-wrap gap-1">
          {card.isKit && <Badge tone="bundle">{t('badge.bundle')}</Badge>}
          {card.isPreOrder && <Badge tone="preOrder">{t('badge.preOrder')}</Badge>}
        </div>
      )}
      <button
        type="button"
        aria-label={t('wishlist.add')}
        className="absolute top-1.5 right-1.5 z-[3] grid size-[34px] cursor-pointer place-items-center rounded-full border-0 bg-white/90 text-text-muted hover:text-danger"
      >
        <Icon name="heart" className="size-4" />
      </button>
      <div className={isOut ? 'opacity-70 grayscale-[0.9]' : undefined}>
        {card.imageUrl !== null ? (
          // A plain <img>: the live Shopee image hosts are not known, so no next/image remote config.
          <img
            src={card.imageUrl}
            alt={card.name}
            loading="lazy"
            className="aspect-square w-full bg-bg object-contain"
          />
        ) : (
          <ImagePlaceholder label={t('imagePlaceholderAlt')} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 pt-2.5 pb-3">
        <h3 className="line-clamp-2 min-h-[calc(1.55em*2)] text-sm leading-[1.55] font-medium [overflow-wrap:anywhere] group-hover:text-primary">
          <Link
            href={`/${locale}/products/${card.productId}`}
            className="after:absolute after:inset-0 after:z-[2] after:content-[''] focus-visible:outline-none"
          >
            {card.name}
          </Link>
        </h3>
        <div className="mt-auto pt-1">
          <PriceDisplay
            satang={card.priceSatang}
            original={card.originalPriceSatang}
            isRange={card.isPriceRange}
          />
        </div>
        {card.isPreOrder && card.releaseDate !== null && (
          <p className="text-xs font-semibold text-accent-dark">
            {t('releaseDate', { date: card.releaseDate })}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <StockBadge status={card.stockStatus} />
        </div>
      </div>
    </article>
  );
}

function Badge({ tone, children }: { tone: 'bundle' | 'preOrder'; children: string }) {
  const colour = tone === 'bundle' ? 'bg-text text-white' : 'bg-accent text-text';
  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-2 py-px text-xs leading-[1.6] font-semibold whitespace-nowrap ${colour}`}
    >
      {children}
    </span>
  );
}
