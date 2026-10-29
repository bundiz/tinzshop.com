import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { getLandingCatalogueReader, getLatestNewsReader } from '@/server/composition-root';
import CategoryShowcase from '../_components/CategoryShowcase';
import HeroZone from '../_components/HeroZone';
import NewsCardSection from '../news/_components/NewsCardSection';
import { newsListPath } from '../news/news-routes';
import ProductSection, { type ProductSectionId } from '../_components/ProductSection';
import SiteFooter from '../_components/SiteFooter';
import SiteHeader from '../_components/SiteHeader';
import TrustStrip from '../_components/TrustStrip';

// Prices and stock come from the mirror on every request; the page is never statically cached.
export const dynamic = 'force-dynamic';

const BEST_SELLERS: ProductSectionId = 'bestSellers';

/** "ข่าวเกมล่าสุด" shows the newest few, as the design's three cards (D-124). */
const LATEST_NEWS_COUNT = 3;

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * The storefront landing page, built from the Shopee catalogue mirror (plan 011) and laid out block for block
 * as `design/index.html` (D-124), ending with "ข่าวเกมล่าสุด", the 3 newest live articles (plan 012), which is
 * left out when there are none.
 */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [catalogue, latestNews, t, tNews] = await Promise.all([
    getLandingCatalogueReader()(locale),
    getLatestNewsReader()({ locale, limit: LATEST_NEWS_COUNT }),
    getTranslations({ locale, namespace: 'shop.home' }),
    getTranslations({ locale, namespace: 'shop.news.landing' }),
  ]);
  const isEmpty =
    catalogue.bundles.length === 0 && catalogue.bestSellers.length === 0 && catalogue.preOrders.length === 0;

  return (
    <>
      <SiteHeader path="/" activeNav="home" />
      <main className="pt-4 pb-10">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6">
          <HeroZone shopNowTarget={catalogue.bestSellers.length > 0 ? BEST_SELLERS : null} />
          <TrustStrip />
          {isEmpty ? (
            <section className="mt-4 rounded-(--radius) bg-bg p-8 text-center text-text-muted">
              <p>{t('empty')}</p>
            </section>
          ) : (
            <>
              <ProductSection
                id="bundles"
                titleKey="home.bundles.title"
                subtitleKey="home.bundles.subtitle"
                cards={catalogue.bundles}
                layout="rail"
                tone="warm"
              />
              <CategoryShowcase />
              <ProductSection id={BEST_SELLERS} titleKey="home.bestSellers.title" cards={catalogue.bestSellers} />
              <ProductSection id="preOrders" titleKey="home.preOrders.title" cards={catalogue.preOrders} />
            </>
          )}
          <NewsCardSection id="news" title={tNews('title')} cards={latestNews} moreHref={newsListPath(locale)} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
