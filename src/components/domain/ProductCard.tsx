import { useTranslations } from 'next-intl';
import PriceDisplay from '@/components/domain/PriceDisplay';
import StockBadge from '@/components/domain/StockBadge';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';

export type ProductCardProps = {
  card: LandingProductCard;
};

/** One product as a card: image, badges, name, price and stock status. */
export default function ProductCard({ card }: ProductCardProps) {
  const t = useTranslations('shop.product');
  const isOut = card.stockStatus === 'out_of_stock';

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-(--radius) border border-border bg-bg shadow-card">
      {(card.isKit || card.isPreOrder) && (
        <div className="absolute top-2 left-2 z-[1] flex flex-wrap gap-1">
          {card.isKit && <Badge tone="bundle">{t('badge.bundle')}</Badge>}
          {card.isPreOrder && <Badge tone="preOrder">{t('badge.preOrder')}</Badge>}
        </div>
      )}
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
        <h3 className="line-clamp-2 min-h-[calc(1.55em*2)] text-sm leading-[1.55] font-medium [overflow-wrap:anywhere]">
          {card.name}
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

/** The design's `.ph` block: a soft gradient with a faint gamepad mark. */
function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="grid aspect-square place-items-center bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#f1f5fd_58%,#e6eefc_100%)]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="w-[42%] fill-none stroke-primary opacity-30"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8.5 6.5h7a5.5 5.5 0 0 1 5.4 6.6l-.7 3.4A2.6 2.6 0 0 1 16 17.6L14.7 16H9.3L8 17.6a2.6 2.6 0 0 1-4.2-1.1l-.7-3.4A5.5 5.5 0 0 1 8.5 6.5Z" />
        <path d="M6.5 11h3.5M8.25 9.25v3.5" />
        <circle cx="15.5" cy="10.4" r=".8" className="fill-primary" />
        <circle cx="17.6" cy="12.6" r=".8" className="fill-primary" />
      </svg>
    </div>
  );
}
