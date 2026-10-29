import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * The listing's `<title>`, "สินค้าทั้งหมด"; in a layout because Next drops a page's metadata when the page
 * calls `notFound()`. The page narrows it to the active category's name.
 */
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'shop.listing.meta' });
  return { title: t('title') };
}

export default function ProductListLayout({ children }: Props) {
  return children;
}
