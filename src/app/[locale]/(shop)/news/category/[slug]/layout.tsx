import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import { decodeSlugParam } from '../../news-routes';
import { readNewsList } from '../../read-news';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

/** The category's name in the `<title>`, or the not-found title for an unknown category (as for products, D-120). */
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const categorySlug = decodeSlugParam(slug);
  const [list, t, tNotFound] = await Promise.all([
    categorySlug === null ? null : readNewsList(locale, categorySlug, 1),
    getTranslations({ locale, namespace: 'shop.news.meta' }),
    getTranslations({ locale, namespace: 'shop.notFound.meta' }),
  ]);
  if (list === null || list.activeCategoryName === null) return { title: tNotFound('title') };
  return { title: t('categoryTitle', { name: list.activeCategoryName }) };
}

export default function NewsCategoryLayout({ children }: Props) {
  return children;
}
