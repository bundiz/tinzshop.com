import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { readArticlesMenu } from '../_components/read-articles-menu';
import ProductListingView from './_components/ProductListingView';
import { readProductListing } from './read-listing';

// Prices, stock and counts come from the mirror on every request; the page is never statically cached.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * The category's name as the `<title>`. The layout gives "สินค้าทั้งหมด", which is what stays when the page
 * calls `notFound()` (Next then drops a page's metadata).
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const [listing, t] = await Promise.all([
    readProductListing(locale, await searchParams),
    getTranslations({ locale, namespace: 'shop.listing.meta' }),
  ]);
  const category = listing?.facets.categories.find((entry) => entry.slug === listing.active.category);
  return category === undefined ? {} : { title: t('categoryTitle', { name: category.name }) };
}

/**
 * Every visible product, filtered, sorted and paged by the URL's search params (plan 013, D-145), as
 * `design/category.html`. Invalid params or a page past the end are a real 404 (R2, D-120).
 */
export default async function ProductListPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [listing, articlesMenu] = await Promise.all([
    readProductListing(locale, await searchParams),
    readArticlesMenu(locale),
  ]);
  if (listing === null) notFound();

  return <ProductListingView listing={listing} articlesMenu={articlesMenu} />;
}
