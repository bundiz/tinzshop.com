import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import ProductCard from '@/components/domain/ProductCard';
import Icon, { type IconName } from '@/components/ui/Icon';
import type { ProductTypeKey } from '@/server/services/catalogue/categorise-by-name';
import type { StorefrontListing, StorefrontListingParams } from '@/server/services/catalogue/storefront-listing-service';
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
};

/** The design's tab icons: เครื่องเกม and แผ่นเกม both use the disc. */
const KIND_ICON: Record<ProductTypeKey, IconName> = {
  console: 'disc',
  game: 'disc',
  controller: 'gamepad',
  accessory: 'headphones',
};

/** The design's price presets, in whole baht; both bounds are inclusive (D-147). */
const PRICE_PRESETS = [
  { key: 'under1000', minBaht: null, maxBaht: 999 },
  { key: 'from1000', minBaht: 1000, maxBaht: 5000 },
  { key: 'from5000', minBaht: 5000, maxBaht: 20000 },
  { key: 'over20000', minBaht: 20001, maxBaht: null },
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

const PILL =
  'flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm whitespace-nowrap hover:border-primary hover:bg-primary-soft hover:text-primary';

/**
 * The all-products page, `/{locale}/product`, laid out block for block as `design/category.html` (plan 013,
 * D-124): breadcrumb, hero band, type tabs, the filter sidebar (a "ตัวกรอง" panel below 900px), toolbar,
 * active-filter chips, the card grid or list, and pagination. Links keep every other filter; the client
 * controls rewrite the URL. No ratings (O-6).
 */
export default function ProductListingView({ listing, articlesMenu }: ProductListingViewProps) {
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

  const title = activeCategory?.name ?? t('title');
  const description =
    activeCategory === null
      ? t('description')
      : kindsInScope.length > 0
        ? t('categoryDescription', {
            types: new Intl.ListFormat(locale, { type: 'conjunction' }).format(kindsInScope.map(kindLabel)),
            name: activeCategory.name,
          })
        : null;

  const tabs: { key: string; label: string; icon: IconName | null; href: string; isActive: boolean }[] = [
    {
      key: 'all',
      label: t('tabs.all'),
      icon: null,
      href: change({ types: [], kit: false }),
      isActive: active.types.length === 0 && !active.kit,
    },
    ...kindsInScope.map((kind) => ({
      key: kind,
      label: kindLabel(kind),
      icon: KIND_ICON[kind],
      href: change({ types: kindSlugs(facets.types, kind, active.category), kit: false }),
      isActive: !active.kit && chosenKinds.length === 1 && chosenKinds[0] === kind,
    })),
    {
      key: 'kit',
      label: t('type.kit'),
      icon: 'package' as const,
      href: change({ types: [], kit: true }),
      isActive: active.kit && active.types.length === 0,
    },
  ];

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

  const filterTitle = (text: string) => <p className="mb-2 text-sm font-bold">{text}</p>;
  const filterBlock = (children: ReactNode) => (
    <div className="border-b border-border py-3.5 last:border-b-0">{children}</div>
  );
  const sideLink = (key: string, label: string, target: string, isActive: boolean, count: number) => (
    <li key={key} className="flex items-center justify-between gap-2 text-sm">
      <Link
        href={target}
        aria-current={isActive ? 'true' : undefined}
        className={`flex min-h-11 items-center hover:text-primary md:min-h-0 md:py-1 ${isActive ? 'font-bold text-primary' : ''}`}
      >
        {label}
      </Link>
      <span className="text-xs text-text-subtle">{count}</span>
    </li>
  );

  const chevron = <Icon name="chevRight" className="size-4" />;
  const isList = active.view === 'list';

  return (
    <>
      <SiteHeader path={`/product${listingQuery(active)}`} activeNav={listingNav(active)} articlesMenu={articlesMenu} />
      <main className="pt-4 pb-10">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6">
          <nav aria-label={t('breadcrumb.label')} className="py-3 text-[13px] text-text-subtle">
            <ol className="flex flex-wrap items-center gap-1">
              <li className="flex items-center gap-1">
                <Link href={`/${locale}`} className="hover:text-primary">
                  {t('breadcrumb.home')}
                </Link>
                {chevron}
              </li>
              <li aria-current="page" className="min-w-0 text-text [overflow-wrap:anywhere]">
                {title}
              </li>
            </ol>
          </nav>

          <div className="mb-3 flex flex-wrap items-end justify-between gap-2.5 rounded-(--radius) bg-[radial-gradient(circle_at_90%_20%,rgba(254,166,1,0.3)_0,rgba(254,166,1,0)_35%),linear-gradient(120deg,var(--color-primary-deep)_0%,var(--color-primary)_100%)] p-[18px] text-white">
            <div>
              <h1 className="text-2xl [overflow-wrap:anywhere]">{title}</h1>
              {description !== null && <p className="text-sm text-[#d6e3fa]">{description}</p>}
            </div>
          </div>

          <nav aria-label={t('tabs.label')} className="mb-3">
            <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((tab) => (
                <li key={tab.key} className="flex-none">
                  <Link
                    href={tab.href}
                    aria-current={tab.isActive ? 'page' : undefined}
                    className={`${PILL} ${
                      tab.isActive ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-bg'
                    }`}
                  >
                    {tab.icon !== null && <Icon name={tab.icon} className="size-4" />}
                    {tab.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <ListingFilterPanelProvider>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[232px_minmax(0,1fr)]">
              <ListingFilterPanel label={t('filters.label')}>
                {filterBlock(
                  <>
                    {filterTitle(t('filters.categories'))}
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
                    </ul>
                  </>,
                )}
                {filterBlock(
                  <>
                    {filterTitle(t('filters.price'))}
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
                    <ul className="mt-2.5 flex flex-wrap gap-1.5">
                      {PRICE_PRESETS.map((preset) => {
                        const isActive = active.minBaht === preset.minBaht && active.maxBaht === preset.maxBaht;
                        return (
                          <li key={preset.key}>
                            <Link
                              href={change({ minBaht: preset.minBaht, maxBaht: preset.maxBaht })}
                              aria-current={isActive ? 'true' : undefined}
                              className={`inline-flex min-h-11 items-center rounded-full border px-2.5 text-xs hover:border-primary hover:text-primary md:min-h-0 md:py-[3px] ${
                                isActive ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-bg'
                              }`}
                            >
                              {t(`filters.preset.${preset.key}`)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>,
                )}
                {filterBlock(
                  <>
                    {filterTitle(t('filters.types'))}
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
                )}
                {filterBlock(
                  <>
                    {filterTitle(t('filters.status'))}
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
                )}
              </ListingFilterPanel>

              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-(--radius) bg-bg px-3.5 py-2.5">
                  <p className="text-sm text-text-muted">
                    {t.rich('toolbar.count', {
                      count: listing.total,
                      strong: (chunks) => <strong className="text-text">{chunks}</strong>,
                    })}
                  </p>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                  <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px]">
                    <span>{t('active.label')}</span>
                    {chips.map((chip) => (
                      <Link
                        key={chip.key}
                        href={chip.href}
                        aria-label={t('active.remove', { name: chip.label })}
                        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-primary bg-primary-soft px-2.5 text-xs text-primary"
                      >
                        {chip.label}
                        <Icon name="x" className="size-4" />
                      </Link>
                    ))}
                    <Link href={clearHref} className="inline-flex min-h-8 items-center text-text-subtle underline">
                      {t('active.clear')}
                    </Link>
                  </div>
                )}

                {listing.cards.length === 0 ? (
                  <section className="rounded-(--radius) bg-bg p-8 text-center text-text-muted">
                    <p>{hasListingFilters(active) ? t('empty') : tShop('home.empty')}</p>
                    {hasListingFilters(active) && (
                      <Link
                        href={clearHref}
                        className="mt-4 inline-flex min-h-11 items-center rounded-(--radius-sm) bg-primary px-5 font-semibold text-white hover:bg-primary-dark"
                      >
                        {t('active.clear')}
                      </Link>
                    )}
                  </section>
                ) : (
                  <ul
                    data-view={active.view}
                    className={
                      isList
                        ? 'grid grid-cols-1 gap-2.5 sm:gap-3'
                        : 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4'
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
