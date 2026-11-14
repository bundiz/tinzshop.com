import { useTranslations } from 'next-intl';
import Link from 'next/link';
import ProductCard from '@/components/domain/ProductCard';
import Icon from '@/components/ui/Icon';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';

export type ProductSectionTitleKey = 'home.bundles.title' | 'home.bestSellers.title' | 'product.related.title';

export type ProductSectionId = 'bundles' | 'bestSellers' | 'preOrders' | 'related';

export type ProductSectionProps = {
  /** The section's element `id`. */
  id: ProductSectionId;
  /** A key under `shop`. */
  titleKey: ProductSectionTitleKey;
  cards: readonly LandingProductCard[];
  subtitleKey?: 'home.bundles.subtitle';
  /** Where the "view all" link goes: the product listing filtered to this section (plan 013); no link without one. */
  moreHref?: string;
  /** The link's label; "ดูทั้งหมด" by default. */
  moreLabelKey?: 'home.section.more' | 'home.bundles.more';
  /**
   * Filter chips in the head (the best sellers' platforms). An entry with `href: null` is the current one, drawn
   * pressed; the others are links to a real listing page (R10).
   */
  filterLinks?: readonly { label: string; href: string | null }[];
  /** `g-5` (2 / 4 / 5 columns, cards 9 and 10 hidden between 860px and 1180px) or `g-4` (2 / 3 / 4). */
  columns: 5 | 4;
  /** Names the chip group for assistive technology, already translated. */
  filterLabel?: string;
};

const GRID_CLASS: Record<ProductSectionProps['columns'], string> = {
  5: 'grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 xl:grid-cols-5 md:max-xl:[&>*:nth-child(n+9)]:hidden',
  4: 'grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4',
};

const CHIP =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-[14.5px] font-medium sm:min-h-10';

/**
 * One titled grid of product cards (the mockup's `.sec` with `.grid`): the head carries an optional subtitle, a
 * "view all" link or filter chips. A section with no products is not rendered at all.
 */
export default function ProductSection({
  id,
  titleKey,
  cards,
  subtitleKey,
  moreHref,
  moreLabelKey = 'home.section.more',
  filterLinks,
  columns,
  filterLabel,
}: ProductSectionProps) {
  const t = useTranslations('shop');
  if (cards.length === 0) return null;

  const titleId = `${id}-title`;

  return (
    <section id={id} aria-labelledby={titleId} className="scroll-mt-4">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:flex-nowrap">
        <div>
          <h2 id={titleId} className="text-[clamp(24px,2.4vw,32px)] font-bold">
            {t(titleKey)}
          </h2>
          {subtitleKey !== undefined && <p className="mt-1.5 text-muted">{t(subtitleKey)}</p>}
        </div>
        {moreHref !== undefined && (
          <Link
            href={moreHref}
            className="inline-flex min-h-11 items-center gap-1.5 bg-[linear-gradient(currentColor,currentColor)] bg-[length:0_1.5px] bg-left-bottom bg-no-repeat font-semibold whitespace-nowrap text-ink hover:bg-[length:100%_1.5px] sm:min-h-0"
          >
            {t(moreLabelKey)}
            <Icon name="chevRight" className="size-4" />
          </Link>
        )}
        {filterLinks !== undefined && filterLinks.length > 0 && (
          <div role="group" aria-label={filterLabel} className="flex flex-wrap gap-2">
            {filterLinks.map((chip) =>
              chip.href === null ? (
                <span key={chip.label} aria-current="true" className={`${CHIP} border-brand bg-brand text-white`}>
                  {chip.label}
                </span>
              ) : (
                <Link
                  key={chip.label}
                  href={chip.href}
                  className={`${CHIP} border-line-2 bg-surface text-ink transition-colors hover:border-ink`}
                >
                  {chip.label}
                </Link>
              ),
            )}
          </div>
        )}
      </div>
      <ul className={GRID_CLASS[columns]}>
        {cards.map((card) => (
          <li key={card.productId} className="min-w-0">
            <ProductCard card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
}
