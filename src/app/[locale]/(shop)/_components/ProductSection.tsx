import { useTranslations } from 'next-intl';
import ProductCard from '@/components/domain/ProductCard';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';

export type ProductSectionTitleKey = 'bundles.title' | 'bestSellers.title' | 'preOrders.title';

export type ProductSectionId = 'bundles' | 'bestSellers' | 'preOrders';

export type ProductSectionProps = {
  /** The section's element `id`, the target of in-page links such as the hero's "shop now". */
  id: ProductSectionId;
  /** A key under `shop.home`. */
  titleKey: ProductSectionTitleKey;
  cards: LandingProductCard[];
  subtitleKey?: 'bundles.subtitle';
  /** `rail` scrolls sideways inside the section (the design's bundle rail); `grid` wraps. */
  layout?: 'grid' | 'rail';
};

const LIST_CLASS: Record<NonNullable<ProductSectionProps['layout']>, string> = {
  grid: 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 min-[900px]:grid-cols-4 min-[1100px]:grid-cols-5',
  rail: 'grid auto-cols-[minmax(158px,1fr)] grid-flow-col gap-2.5 overflow-x-auto pb-1.5 [scrollbar-width:thin] snap-x snap-mandatory min-[1100px]:auto-cols-[calc((100%-50px)/6)]',
};

/** One titled list of product cards; a section with no products is not rendered at all. */
export default function ProductSection({ id, titleKey, cards, subtitleKey, layout = 'grid' }: ProductSectionProps) {
  const t = useTranslations('shop.home');
  if (cards.length === 0) return null;

  const titleId = `${id}-title`;
  const tint =
    layout === 'rail' ? 'bg-[linear-gradient(180deg,var(--color-accent-soft)_0%,var(--color-bg)_140px)]' : 'bg-bg';

  return (
    <section id={id} aria-labelledby={titleId} className={`mt-4 scroll-mt-4 rounded-(--radius) p-4 min-[900px]:p-5 ${tint}`}>
      <h2
        id={titleId}
        className="mb-3.5 flex items-center gap-2.5 text-[19px] before:h-5 before:w-1 before:shrink-0 before:rounded-[2px] before:bg-accent before:content-['']"
      >
        {t(titleKey)}
      </h2>
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
