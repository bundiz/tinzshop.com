import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import { getLandingCatalogueReader, getLatestNewsReader } from '@/server/composition-root';
import ConsultBand from '../_components/ConsultBand';
import Hero from '../_components/Hero';
import NewsCardSection from '../news/_components/NewsCardSection';
import { newsListPath } from '../news/news-routes';
import { NAV_CATEGORY_SLUGS, listingHref } from '../product/listing-url';
import PlatformBanners from '../_components/PlatformBanners';
import PlatformTiles from '../_components/PlatformTiles';
import ProductSection from '../_components/ProductSection';
import Reasons from '../_components/Reasons';
import SiteFooter from '../_components/SiteFooter';
import SiteHeader from '../_components/SiteHeader';
import { readArticlesMenu } from '../_components/read-articles-menu';
import { readCurrentCustomer } from '../_components/read-current-customer';
import { pickHeroCards } from './hero-cards';
import { readLatestNewsOrNone } from './read-latest-news';

// Prices and stock come from the mirror on every request; the page is never statically cached.
export const dynamic = 'force-dynamic';

/** "ข่าวเกมล่าสุด" shows the newest few, as the mockup's three cards. */
const LATEST_NEWS_COUNT = 3;

type Props = {
  params: Promise<{ locale: string }>;
};

/** The mockup's `.sec`: a gutter-wide block with the section gap above it. */
function Sec({ children }: { children: ReactNode }) {
  return <div className="wrap pt-[clamp(48px,6vw,80px)]">{children}</div>;
}

/**
 * The storefront landing page, built from the Shopee catalogue mirror (plan 011) and laid out as the redesign's
 * home (plan 015, `tinzshop-redesign/`): hero, platform tiles, promotion sets, platform banners, best sellers,
 * reasons, the LINE consult band and "ข่าวเกมล่าสุด", the 3 newest live articles (plan 012), left out when there
 * are none. The pre-order list and the store-visit block are not rendered (plan 005; address and hours unknown).
 */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [catalogue, latestNews, t, tNews, articlesMenu, customer] = await Promise.all([
    getLandingCatalogueReader()(locale),
    // A failing news read hides the news section; it never takes the landing page down.
    readLatestNewsOrNone(() => getLatestNewsReader()({ locale, limit: LATEST_NEWS_COUNT })),
    getTranslations({ locale, namespace: 'shop.home' }),
    getTranslations({ locale, namespace: 'shop.news.landing' }),
    readArticlesMenu(locale),
    readCurrentCustomer(),
  ]);
  const isEmpty = catalogue.bundles.length === 0 && catalogue.bestSellers.length === 0;
  const { feature, minis } = pickHeroCards(catalogue);

  // "ทั้งหมด" is the page you are on; the platforms are real listing pages, best sellers first (R10).
  const bestSellerChips = [
    { label: t('bestSellers.all'), href: null },
    ...(['ps5', 'switch', 'gadgets'] as const).map((key) => ({
      label: t(`bestSellers.${key}`),
      href: listingHref(locale, { category: NAV_CATEGORY_SLUGS[key], sort: 'best_selling' }),
    })),
  ];

  return (
    <>
      <SiteHeader path="/" activeNav="home" articlesMenu={articlesMenu} customer={customer} />
      <main id="main" className="pb-[clamp(48px,6vw,80px)]">
        <Hero feature={feature} minis={minis} signedIn={customer !== null} />
        <PlatformTiles />
        {isEmpty ? (
          <Sec>
            <section className="rounded-lg border border-line bg-surface p-8 text-center text-muted">
              <p>{t('empty')}</p>
            </section>
          </Sec>
        ) : (
          <>
            {catalogue.bundles.length > 0 && (
              <Sec>
                <ProductSection
                  id="bundles"
                  titleKey="home.bundles.title"
                  subtitleKey="home.bundles.subtitle"
                  cards={catalogue.bundles}
                  moreHref={listingHref(locale, { kit: true })}
                  moreLabelKey="home.bundles.more"
                  columns={5}
                />
              </Sec>
            )}
            <PlatformBanners />
            {catalogue.bestSellers.length > 0 && (
              <Sec>
                <ProductSection
                  id="bestSellers"
                  titleKey="home.bestSellers.title"
                  cards={catalogue.bestSellers}
                  filterLinks={bestSellerChips}
                  filterLabel={t('bestSellers.filterLabel')}
                  columns={5}
                />
              </Sec>
            )}
          </>
        )}
        <Reasons />
        <ConsultBand />
        {latestNews.length > 0 && (
          <Sec>
            <NewsCardSection id="news" title={tNews('title')} cards={latestNews} moreHref={newsListPath(locale)} />
          </Sec>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
