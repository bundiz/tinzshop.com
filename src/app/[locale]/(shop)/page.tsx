import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { getLandingCatalogueReader } from '@/server/composition-root';
import Hero from './_components/Hero';
import ProductSection, { type ProductSectionId } from './_components/ProductSection';
import SiteFooter from './_components/SiteFooter';
import SiteHeader from './_components/SiteHeader';
import TrustStrip from './_components/TrustStrip';

// Prices and stock come from the mirror on every request; the page is never statically cached.
export const dynamic = 'force-dynamic';

const BEST_SELLERS: ProductSectionId = 'bestSellers';

type Props = {
  params: Promise<{ locale: string }>;
};

/** The storefront landing page, built from the Shopee catalogue mirror (plan 011). */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [catalogue, t] = await Promise.all([
    getLandingCatalogueReader()(locale),
    getTranslations({ locale, namespace: 'shop.home' }),
  ]);
  const isEmpty =
    catalogue.bundles.length === 0 && catalogue.bestSellers.length === 0 && catalogue.preOrders.length === 0;

  return (
    <>
      <SiteHeader path="/" />
      <main className="pt-4 pb-10">
        <div className="mx-auto max-w-[1280px] px-4 min-[900px]:px-6">
          <Hero shopNowTarget={catalogue.bestSellers.length > 0 ? BEST_SELLERS : null} />
          <TrustStrip />
          {isEmpty ? (
            <section className="mt-4 rounded-(--radius) bg-bg p-8 text-center text-text-muted">
              <p>{t('empty')}</p>
            </section>
          ) : (
            <>
              <ProductSection
                id="bundles"
                titleKey="bundles.title"
                subtitleKey="bundles.subtitle"
                cards={catalogue.bundles}
                layout="rail"
              />
              <ProductSection id={BEST_SELLERS} titleKey="bestSellers.title" cards={catalogue.bestSellers} />
              <ProductSection id="preOrders" titleKey="preOrders.title" cards={catalogue.preOrders} />
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
