import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import { readProduct } from './read-product';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; productId: string }>;
};

/**
 * The product's `<title>`. It lives in this layout, not the page, because Next drops a page's metadata
 * when the page calls `notFound()`; a layout's survives, so a missing product gets a not-found title.
 */
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale, productId } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const [product, t] = await Promise.all([
    readProduct(productId, locale),
    getTranslations({ locale, namespace: 'shop.product' }),
  ]);
  return { title: t('meta.title', { name: product === null ? t('notFound.title') : product.name }) };
}

export default function ProductLayout({ children }: Props) {
  return children;
}
