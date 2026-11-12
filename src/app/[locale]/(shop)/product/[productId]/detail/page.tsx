import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { routing } from '@/i18n/routing';
import { getLandingCatalogueReader } from '@/server/composition-root';
import ProductSection from '../../../_components/ProductSection';
import SiteFooter from '../../../_components/SiteFooter';
import SiteHeader from '../../../_components/SiteHeader';
import { readArticlesMenu } from '../../../_components/read-articles-menu';
import { requireCustomer } from '../../../_components/require-customer';
import BuyActions from './_components/BuyActions';
import Gallery from './_components/Gallery';
import ProductHeading from './_components/ProductHeading';
import ProductTabs from './_components/ProductTabs';
import ServicePanel from './_components/ServicePanel';
import VariantPicker from './_components/VariantPicker';
import { listingHref } from '../../listing-url';
import { breadcrumbItems } from './breadcrumb-items';
import { readProduct } from './read-product';

// Prices and stock come from the mirror on every request; the page is never statically cached.
export const dynamic = 'force-dynamic';

const RELATED_LIMIT = 5;

type Props = {
  params: Promise<{ locale: string; productId: string }>;
};

/**
 * One product at `/{locale}/product/{productId}/detail` (D-142), built from the Shopee catalogue mirror (plan 011)
 * and laid out as the redesign's product page (plan 015, D-198). Unknown, malformed or hidden ids are a real 404 (D-120).
 */
export default async function ProductPage({ params }: Props) {
  const { locale, productId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Sign-in is required for the product pages (O-10): on the server, back to this product after.
  const customer = await requireCustomer(locale, `/product/${encodeURIComponent(productId)}/detail`);

  const [product, t, catalogue, articlesMenu] = await Promise.all([
    readProduct(productId, locale),
    getTranslations({ locale, namespace: 'shop.product' }),
    getLandingCatalogueReader()(locale),
    readArticlesMenu(locale),
  ]);
  if (product === null) notFound();
  // Related products: the best sellers, without this one, until categories exist to relate by (D-124).
  const related = catalogue.bestSellers.filter((card) => card.productId !== product.productId).slice(0, RELATED_LIMIT);

  // VariantPicker draws the phone buy bar only when there is a variant to buy (default, else first).
  const hasBuyBar = (product.variants.find((v) => v.variantId === product.defaultVariantId) ?? product.variants[0]) !== undefined;

  return (
    <>
      <SiteHeader path={`/product/${product.productId}/detail`} articlesMenu={articlesMenu} customer={customer} />
      <main id="main" className="sm:pb-10">
        <div className="wrap">
          <Breadcrumbs
            label={t('breadcrumb.label')}
            items={breadcrumbItems(
              locale,
              { home: t('breadcrumb.home'), allProducts: t('breadcrumb.allProducts') },
              {
                productName: product.name,
                platformCategory: product.platformCategory,
                productType: product.productType,
              },
            )}
          />
          <div className="grid grid-cols-1 items-start gap-10 pt-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Gallery imageUrls={product.imageUrls} name={product.name} />
            <section aria-labelledby="product-title" className="min-w-0">
              <ProductHeading
                name={product.name}
                isKit={product.isKit}
                isPreOrder={product.isPreOrder}
                releaseDate={product.releaseDate}
                platform={product.platformCategory}
                productType={product.productType}
              />
              <VariantPicker
                optionTypes={product.optionTypes}
                variants={product.variants}
                defaultVariantId={product.defaultVariantId}
              />
              <BuyActions />
              <ServicePanel />
            </section>
          </div>
          <ProductTabs
            description={product.description}
            brandName={product.brandName}
            shippingSizeTier={product.shippingSizeTier}
          />
          {related.length > 0 && (
            <div className="pt-[clamp(48px,6vw,80px)]">
              <ProductSection
                id="related"
                titleKey="product.related.title"
                cards={related}
                columns={5}
                moreHref={listingHref(locale, { sort: 'best_selling' })}
              />
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
      {/* Room for the phone buy bar (VariantPicker), so the footer's last row scrolls fully above it. */}
      {hasBuyBar && <div aria-hidden="true" data-buy-bar-spacer="" className="h-[84px] sm:hidden" />}
    </>
  );
}
