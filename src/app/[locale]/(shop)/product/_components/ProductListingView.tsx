import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import ProductCard from '@/components/domain/ProductCard';
import ImagePlaceholder, { type ProductArt } from '@/components/domain/ImagePlaceholder';
import { platformTone } from '@/components/domain/platform-tone';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Icon from '@/components/ui/Icon';
import { buttonClass } from '@/components/ui/button-class';
import type { ProductTypeKey } from '@/server/services/catalogue/categorise-by-name';
import {
  STOREFRONT_LISTING_PAGE_SIZE,
  type StorefrontListing,
  type StorefrontListingParams,
} from '@/server/services/catalogue/storefront-listing-service';
import Pagination from '../../news/_components/Pagination';
import SiteFooter from '../../_components/SiteFooter';
import type { ArticlesMenuEntry } from '../../_components/articles-menu';
import SiteHeader, { type SiteNavKey } from '../../_components/SiteHeader';
import {
  NAV_CATEGORY_SLUGS,
  PRODUCT_TYPE_KINDS,
  clearedListing,
  hasListingFilters,
  kindCount,
  kindSlugs,
  listingHref,
  listingQuery,
  nextListing,
  selectedKinds,
  toggleKind,
  withCategory,
} from '../listing-url';
import {
  ListingCheck,
  ListingFilterPanel,
  ListingFilterPanelProvider,
  ListingFilterToggle,
  ListingPriceRange,
  ListingSortSelect,
  ListingViewToggle,
} from './ListingControls';

export type ProductListingViewProps = {
  listing: StorefrontListing;
  /** The header's "บทความ" menu (`readArticlesMenu`). */
  articlesMenu: ArticlesMenuEntry[];
  /** The signed-in customer for the header (`readCurrentCustomer`), or null. */
  customer?: { firstName: string } | null;
};

/** The tiles' art: เครื่องเกม and ทั้งหมด use the console, the others their own (plan 015, R12). */
const KIND_ART: Record<ProductTypeKey, ProductArt> = {
  console: 'console',
  game: 'disc',
  controller: 'pad',
  accessory: 'head',
};

/**
 * The design's price presets, in whole baht, with no overlap: `min` is inclusive and `max` means below
 * `max + 1` baht, so ต่ำกว่า ฿2,000 (`max=1999`) covers ฿1,999.99 (D-148, D-197).
 */
export const PRICE_PRESETS = [
  { key: 'under2000', minBaht: null, maxBaht: 1999 },
  { key: 'from2000', minBaht: 2000, maxBaht: 9999 },
  { key: 'over10000', minBaht: 10000, maxBaht: null },
] as const;

/** The nav entry the listing's filters match, drawn as current in the header. */
export function listingNav(active: StorefrontListingParams): SiteNavKey | undefined {
  const platform = (Object.keys(NAV_CATEGORY_SLUGS) as (keyof typeof NAV_CATEGORY_SLUGS)[]).find(
    (key) => NAV_CATEGORY_SLUGS[key] === active.category,
  );
  if (platform !== undefined) return platform;
  if (active.category !== null) return undefined;
  if (active.preOrder && !active.kit) return 'preOrder';
  if (active.kit && !active.preOrder) return 'bundles';
  return undefined;
}

const CHIP_BASE = 'inline-flex items-center gap-1.5 rounded-full border-[1.5px] font-medium';
const CHIP = `${CHIP_BASE} min-h-11 px-4 text-[14.5px] sm:min-h-10`;
/** The active-filter chip: smaller than the preset chip, so it shares only the base. */
export const CHIP_ACTIVE_FILTER = `${CHIP_BASE} min-h-11 px-3 text-sm sm:min-h-9`;
const CHIP_OFF = 'border-line-2 bg-surface hover:border-ink';
const CHIP_ON = 'border-brand bg-brand text-white';

/**
 * The all-products page, `/{locale}/product`, laid out as `tinzshop-redesign/` (plan 015, D-197): breadcrumb,
 * head, type tiles, the filters (a sticky column from 1024px, a sheet below it), toolbar, active-filter chips,
 * the card grid or list, and pagination. Links keep every other filter; the client controls rewrite the URL.
 */
export default function ProductListingView({ listing, articlesMenu, customer = null }: ProductListingViewProps) {
  const t = useTranslations('shop.listing');
  const tShop = useTranslations('shop');
  const locale = useLocale();
  const { active, facets } = listing;
  const href = (state: StorefrontListingParams) => listingHref(locale, state);
  const change = (patch: Partial<StorefrontListingParams>) => href(nextListing(active, patch));

  const activeCategory = facets.categories.find((category) => category.slug === active.category) ?? null;
  const kindsInScope = PRODUCT_TYPE_KINDS.filter((kind) => kindSlugs(facets.types, kind, active.category).length > 0);
  const chosenKinds = selectedKinds(facets.types, active.types);
  const kindLabel = (kind: ProductTypeKey) => t(`type.${kind}`);

  // The head's count is the toolbar's (D-203): products with no category are in no facet, so a facet sum would drift.
  const allCount = listing.total;
  const title = activeCategory?.name ?? t('title');
  const description =
    activeCategory === null
      ? t('description', { count: allCount })
      : kindsInScope.length > 0
        ? t('categoryDescription', {
            types: new Intl.ListFormat(locale, { type: 'conjunction' }).format(kindsInScope.map(kindLabel)),
            name: activeCategory.name,
            count: allCount,
          })
        : null;

  const pageSize = STOREFRONT_LISTING_PAGE_SIZE;
  const from = listing.total === 0 ? 0 : (listing.page - 1) * pageSize + 1;
  const to = Math.min(listing.page * pageSize, listing.total);

  const tabs: { key: string; label: string; art: ProductArt; count: number | null; href: string; isActive: boolean }[] = [
    {
      key: 'all',
      label: t('tabs.all'),
      art: 'console',
      // Only the active tile can state a count that is true: kind-narrowed facets would shrink it (D-148, D-203).
      count: active.types.length === 0 && !active.kit ? listing.total : null,
      href: change({ types: [], kit: false }),
      isActive: active.types.length === 0 && !active.kit,
    },
    ...kindsInScope.map((kind) => ({
      key: kind,
      label: kindLabel(kind),
      art: KIND_ART[kind],
      count: kindCount(facets.types, kind, active.category),
      href: change({ types: kindSlugs(facets.types, kind, active.category), kit: false }),
      isActive: !active.kit && chosenKinds.length === 1 && chosenKinds[0] === kind,
    })),
    {
      key: 'kit',
      label: t('type.kit'),
      art: 'box',
      count: facets.kit,
      href: change({ types: [], kit: true }),
      isActive: active.kit && active.types.length === 0,
    },
  ];
  const tone = platformTone(active.category);

  const priceLabel =
    active.minBaht !== null && active.maxBaht !== null
      ? t('active.price', { min: active.minBaht, max: active.maxBaht })
      : active.minBaht !== null
        ? t('active.priceMin', { min: active.minBaht })
        : active.maxBaht !== null
          ? t('active.priceMax', { max: active.maxBaht })
          : null;
  const chips: { key: string; label: string; href: string }[] = [
    ...(activeCategory === null
      ? []
      : [{ key: 'category', label: activeCategory.name, href: href(withCategory(facets.types, active, null)) }]),
    ...chosenKinds.map((kind) => ({
      key: `type-${kind}`,
      label: kindLabel(kind),
      href: change({ types: toggleKind(facets.types, active, kind) }),
    })),
    ...(priceLabel === null ? [] : [{ key: 'price', label: priceLabel, href: change({ minBaht: null, maxBaht: null }) }]),
    ...(active.inStock ? [{ key: 'inStock', label: t('active.inStock'), href: change({ inStock: false }) }] : []),
    ...(active.kit ? [{ key: 'kit', label: t('type.kit'), href: change({ kit: false }) }] : []),
    ...(active.preOrder ? [{ key: 'preOrder', label: t('filters.preOrder'), href: change({ preOrder: false }) }] : []),
  ];
  const clearHref = href(clearedListing(active));

  // Each filter block is a <details open> group whose summary is its heading; the checkbox groups are also
  // `role="group"` labelled by that summary, so a screen reader announces the group with each box.
  const filterGroup = (key: string, heading: string, body: ReactNode, labelled = false) => (
    <details open className="group border-b border-line py-4 last:border-b-0">
      <summary
        id={`filter-${key}`}
        className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold sm:min-h-8 [&::-webkit-details-marker]:hidden"
      >
        {heading}
        <Icon name="chevDown" className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div
        role={labelled ? 'group' : undefined}
        aria-labelledby={labelled ? `filter-${key}` : undefined}
        className="mt-2.5 grid gap-1"
      >
        {body}
      </div>
    </details>
  );
  const sideLink = (key: string, label: string, target: string, isActive: boolean, count: number) => (
    <li key={key} className="flex items-center justify-between gap-2 text-[15px]">
      <Link
        href={target}
        aria-current={isActive ? 'true' : undefined}
        className={`flex min-h-11 flex-1 items-center hover:text-brand sm:min-h-10 ${isActive ? 'font-bold text-brand' : ''}`}
      >
        {label}
      </Link>
      <span className="text-[13px] text-muted">{count}</span>
    </li>
  );

  const isList = active.view === 'list';

  return (
    <>
      <SiteHeader path={`/product${listingQuery(active)}`} activeNav={listingNav(active)} articlesMenu={articlesMenu} customer={customer} />
      <main id="main" className="pb-10 sm:pb-16">
        <div className="wrap">
          <Breadcrumbs
            label={t('breadcrumb.label')}
            items={[{ label: t('breadcrumb.home'), href: `/${locale}` }, { label: title }]}
          />

          <div className="flex flex-wrap items-end justify-between gap-4 pt-3 pb-5">
            <div>
              <h1 className="text-[clamp(28px,3vw,40px)] font-bold [overflow-wrap:anywhere]">{title}</h1>
              {description !== null && <p className="mt-1 text-muted">{description}</p>}
            </div>
          </div>

          <nav aria-label={t('tabs.label')} className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={tab.isActive ? 'page' : undefined}
                className={`flex min-h-11 flex-col items-center gap-2.5 rounded-md border-[1.5px] bg-surface px-2.5 pt-3.5 pb-3 text-center text-[14.5px] font-medium transition-colors hover:border-ink-2 ${
                  tab.isActive ? 'border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]' : 'border-line'
                }`}
              >
                <ImagePlaceholder tone={tone} art={tab.art} className="w-16 rounded-[10px]" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <small className="-mt-1.5 text-[12.5px] font-normal text-muted">{t('tabs.count', { count: tab.count })}</small>
                )}
              </Link>
            ))}
          </nav>

          <ListingFilterPanelProvider>
            <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[268px_minmax(0,1fr)]">
              <ListingFilterPanel
                label={t('filters.label')}
                heading={t('filters.toggle')}
                closeLabel={t('filters.close')}
                applyLabel={t('filters.apply', { count: listing.total })}
              >
                {filterGroup(
                  'categories',
                  t('filters.categories'),
                  <ul>
                    {facets.categories.map((category) =>
                      sideLink(
                        category.slug,
                        category.name,
                        href(withCategory(facets.types, active, active.category === category.slug ? null : category.slug)),
                        active.category === category.slug,
                        category.count,
                      ),
                    )}
                    {sideLink(
                      'pre-order',
                      t('filters.preOrder'),
                      change({ preOrder: !active.preOrder }),
                      active.preOrder,
                      facets.preOrder,
                    )}
                  </ul>,
                )}
                {filterGroup(
                  'status',
                  t('filters.status'),
                  <>
                    <ListingCheck
                      label={t('filters.inStock')}
                      checked={active.inStock}
                      href={change({ inStock: !active.inStock })}
                    />
                    <ListingCheck
                      label={t('filters.preOrderOnly')}
                      checked={active.preOrder}
                      href={change({ preOrder: !active.preOrder })}
                    />
                  </>,
                  true,
                )}
                {filterGroup(
                  'types',
                  t('filters.types'),
                  <>
                    {kindsInScope.map((kind) => (
                      <ListingCheck
                        key={kind}
                        label={kindLabel(kind)}
                        count={kindCount(facets.types, kind, active.category)}
                        checked={chosenKinds.includes(kind)}
                        href={change({ types: toggleKind(facets.types, active, kind) })}
                      />
                    ))}
                    <ListingCheck
                      label={t('type.kit')}
                      count={facets.kit}
                      checked={active.kit}
                      href={change({ kit: !active.kit })}
                    />
                  </>,
                  true,
                )}
                {filterGroup(
                  'price',
                  t('filters.price'),
                  <>
                    <ListingPriceRange
                      locale={locale}
                      active={active}
                      labels={{
                        min: t('filters.min'),
                        max: t('filters.max'),
                        minPlaceholder: t('filters.minPlaceholder'),
                        maxPlaceholder: t('filters.maxPlaceholder'),
                      }}
                    />
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {PRICE_PRESETS.map((preset) => {
                        const isActive = active.minBaht === preset.minBaht && active.maxBaht === preset.maxBaht;
                        return (
                          <li key={preset.key}>
                            <Link
                              href={change({ minBaht: preset.minBaht, maxBaht: preset.maxBaht })}
                              aria-current={isActive ? 'true' : undefined}
                              className={`${CHIP} ${isActive ? CHIP_ON : CHIP_OFF}`}
                            >
                              {t(`filters.preset.${preset.key}`)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>,
                )}
              </ListingFilterPanel>

              <div className="min-w-0">
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-ink-2">
                    {t.rich('toolbar.count', {
                      from,
                      to,
                      total: listing.total,
                      b: (chunks) => <b className="text-ink">{chunks}</b>,
                    })}
                  </p>
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <ListingFilterToggle label={t('filters.toggle')} />
                    <ListingSortSelect
                      locale={locale}
                      active={active}
                      label={t('toolbar.sortLabel')}
                      options={{
                        recommended: t('toolbar.sort.recommended'),
                        best_selling: t('toolbar.sort.best_selling'),
                        newest: t('toolbar.sort.newest'),
                        price_asc: t('toolbar.sort.price_asc'),
                        price_desc: t('toolbar.sort.price_desc'),
                      }}
                    />
                    <ListingViewToggle
                      active={active.view}
                      hrefs={{ grid: change({ view: 'grid' }), list: change({ view: 'list' }) }}
                      labels={{ group: t('toolbar.viewLabel'), grid: t('toolbar.grid'), list: t('toolbar.list') }}
                    />
                  </div>
                </div>

                {chips.length > 0 && (
                  <div className="mb-[18px] flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span>{t('active.label')}</span>
                    {chips.map((chip) => (
                      <Link
                        key={chip.key}
                        href={chip.href}
                        aria-label={t('active.remove', { name: chip.label })}
                        data-active-filter=""
                        className={`${CHIP_ACTIVE_FILTER} ${CHIP_ON}`}
                      >
                        {chip.label}
                        <Icon name="x" className="size-4" />
                      </Link>
                    ))}
                    <Link
                      href={clearHref}
                      className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-[3px] hover:underline sm:min-h-9"
                    >
                      {t('active.clear')}
                    </Link>
                  </div>
                )}

                {listing.cards.length === 0 ? (
                  <section className="rounded-lg border border-line bg-surface p-8 text-center text-muted">
                    <p>{hasListingFilters(active) ? t('empty') : tShop('home.empty')}</p>
                    {hasListingFilters(active) && (
                      <Link href={clearHref} className={`${buttonClass({ variant: 'brand' })} mt-4`}>
                        {t('active.clear')}
                      </Link>
                    )}
                  </section>
                ) : (
                  <ul
                    data-view={active.view}
                    className={
                      isList
                        ? 'grid grid-cols-1 gap-2.5 sm:gap-4'
                        : 'grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4'
                    }
                  >
                    {listing.cards.map((card) => (
                      <li key={card.productId} className="min-w-0">
                        <ProductCard card={card} layout={active.view} />
                      </li>
                    ))}
                  </ul>
                )}

                <Pagination
                  basePath={href({ ...active, page: 1 })}
                  page={listing.page}
                  totalPages={listing.totalPages}
                  hrefFor={(page) => change({ page })}
                />
              </div>
            </div>
          </ListingFilterPanelProvider>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
