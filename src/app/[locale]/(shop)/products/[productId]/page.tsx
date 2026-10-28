import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { getProductDetailReader } from '@/server/composition-root';
import SiteFooter from '../../_components/SiteFooter';
import SiteHeader from '../../_components/SiteHeader';
import Breadcrumb from './_components/Breadcrumb';
import Gallery from './_components/Gallery';
import ProductTabs from './_components/ProductTabs';
import ServicePanel from './_components/ServicePanel';
import VariantPicker from './_components/VariantPicker';

// Prices and stock come from the mirror on every request; the page is never statically cached.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; productId: string }>;
};

/** One product, built from the Shopee catalogue mirror (plan 011). Unknown, malformed or hidden ids are 404. */
export default async function ProductPage({ params }: Props) {
  const { locale, productId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [product, t] = await Promise.all([
    getProductDetailReader()(productId, locale),
    getTranslations({ locale, namespace: 'shop.product' }),
  ]);
  if (product === null) notFound();

  return (
    <>
      <SiteHeader path={`/products/${product.productId}`} />
      <main className="pb-10">
        <div className="mx-auto max-w-[1280px] px-4 min-[900px]:px-6">
          <Breadcrumb productName={product.name} />
          <div className="grid grid-cols-1 items-start gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_280px]">
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
              <h1 id="product-title" className="text-[22px] leading-[1.5] [overflow-wrap:anywhere]">
                {product.name}
              </h1>
              <VariantPicker
                optionTypes={product.optionTypes}
                variants={product.variants}
                defaultVariantId={product.defaultVariantId}
              />
            </section>
            <ServicePanel />
          </div>
          <ProductTabs
            description={product.description}
            brandName={product.brandName}
            shippingSizeTier={product.shippingSizeTier}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
