import { useTranslations } from 'next-intl';
import ProductCard from '@/components/domain/ProductCard';
import Icon from '@/components/ui/Icon';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';

export type ProductSectionTitleKey =
  | 'home.bundles.title'
  | 'home.bestSellers.title'
  | 'home.preOrders.title'
  | 'product.related.title';

export type ProductSectionId = 'bundles' | 'bestSellers' | 'preOrders' | 'related';

export type ProductSectionProps = {
  /** The section's element `id`, the target of in-page links such as the hero's "shop now". */
  id: ProductSectionId;
  /** A key under `shop`. */
  titleKey: ProductSectionTitleKey;
  cards: LandingProductCard[];
  subtitleKey?: 'home.bundles.subtitle';
  /** `rail` scrolls sideways inside the section (the design's bundle rail); `grid` wraps. */
  layout?: 'grid' | 'rail';
  /** `warm` is the bundle section's accent-soft wash at the top; `plain` is white. */
  tone?: 'plain' | 'warm';
};

const LIST_CLASS: Record<NonNullable<ProductSectionProps['layout']>, string> = {
  grid: 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5',
  rail: 'grid auto-cols-[minmax(158px,1fr)] grid-flow-col gap-2.5 overflow-x-auto pb-1.5 [scrollbar-width:thin] snap-x snap-mandatory lg:auto-cols-[calc((100%-50px)/6)]',
};

/**
 * One titled list of product cards with the design's "view all" link (inert until category pages exist, D-124);
 * a section with no products is not rendered at all.
 */
export default function ProductSection({
  id,
  titleKey,
  cards,
  subtitleKey,
  layout = 'grid',
  tone = 'plain',
}: ProductSectionProps) {
  const t = useTranslations('shop');
  if (cards.length === 0) return null;

  const titleId = `${id}-title`;
  const tint =
    tone === 'warm' ? 'bg-[linear-gradient(180deg,var(--color-accent-soft)_0%,var(--color-bg)_140px)]' : 'bg-bg';

  return (
    <section id={id} aria-labelledby={titleId} className={`mt-4 scroll-mt-4 rounded-(--radius) p-4 md:p-5 ${tint}`}>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2
          id={titleId}
          className="flex items-center gap-2.5 text-[19px] before:h-5 before:w-1 before:shrink-0 before:rounded-[2px] before:bg-accent before:content-['']"
        >
          {t(titleKey)}
        </h2>
        <a
          href="#"
          className="inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold whitespace-nowrap text-primary hover:underline"
        >
          {t('home.section.more')}
          <Icon name="chevRight" className="size-4" />
        </a>
      </div>
      {subtitleKey !== undefined && (
        <p className="-mt-2 mb-3.5 text-[13px] text-text-subtle">{t(subtitleKey)}</p>
      )}
      <ul
        className={LIST_CLASS[layout]}
        // A sideways-scrolling rail must be reachable by keyboard to be scrolled.
        tabIndex={layout === 'rail' ? 0 : undefined}
        aria-labelledby={layout === 'rail' ? titleId : undefined}
      >
        {cards.map((card) => (
          <li key={card.productId} className="min-w-0 snap-start">
            <ProductCard card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
}
