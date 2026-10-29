import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { getLandingCatalogueReader } from '@/server/composition-root';
import ProductSection from '../../../_components/ProductSection';
import SiteFooter from '../../../_components/SiteFooter';
import SiteHeader from '../../../_components/SiteHeader';
import { readArticlesMenu } from '../../../_components/read-articles-menu';
import Breadcrumb from './_components/Breadcrumb';
import BuyActions from './_components/BuyActions';
import Gallery from './_components/Gallery';
import ProductHeading from './_components/ProductHeading';
import ProductTabs from './_components/ProductTabs';
import ServicePanel from './_components/ServicePanel';
import VariantPicker from './_components/VariantPicker';
import { readProduct } from './read-product';

// Prices and stock come from the mirror on every request; the page is never statically cached.
export const dynamic = 'force-dynamic';

const RELATED_LIMIT = 6;

type Props = {
  params: Promise<{ locale: string; productId: string }>;
};

/**
 * One product at `/{locale}/product/{productId}/detail` (D-142), built from the Shopee catalogue mirror (plan 011)
 * and laid out as `design/product.html` (D-124). Unknown, malformed or hidden ids are a real 404 (D-120).
 */
export default async function ProductPage({ params }: Props) {
  const { locale, productId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [product, t, catalogue, articlesMenu] = await Promise.all([
    readProduct(productId, locale),
    getTranslations({ locale, namespace: 'shop.product' }),
    getLandingCatalogueReader()(locale),
    readArticlesMenu(locale),
  ]);
  if (product === null) notFound();
  // Related products: the best sellers, without this one, until categories exist to relate by (D-124).
  const related = catalogue.bestSellers.filter((card) => card.productId !== product.productId).slice(0, RELATED_LIMIT);

  return (
    <>
      <SiteHeader path={`/product/${product.productId}/detail`} articlesMenu={articlesMenu} />
      <main className="pt-4 pb-10">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6">
          <Breadcrumb
            productName={product.name}
            platformCategory={product.platformCategory}
            productType={product.productType}
          />
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_280px]">
            <Gallery imageUrls={product.imageUrls} name={product.name} />
            <section aria-labelledby="product-title" className="min-w-0 rounded-(--radius) bg-bg p-4">
              {product.isPreOrder && (
                <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center rounded-[4px] bg-accent px-2 py-px text-xs leading-[1.6] font-semibold text-text">
                    {t('badge.preOrder')}
                  </span>
                  {product.releaseDate !== null && (
                    <span className="text-xs font-semibold text-accent-dark">
                      {t('releaseDate', { date: product.releaseDate })}
                    </span>
                  )}
                </p>
              )}
              <ProductHeading name={product.name} isKit={product.isKit} />
              <VariantPicker
                optionTypes={product.optionTypes}
                variants={product.variants}
                defaultVariantId={product.defaultVariantId}
              />
              <BuyActions />
            </section>
            <ServicePanel />
          </div>
          <ProductTabs
            description={product.description}
            brandName={product.brandName}
            shippingSizeTier={product.shippingSizeTier}
          />
          <ProductSection id="related" titleKey="product.related.title" cards={related} layout="rail" />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
