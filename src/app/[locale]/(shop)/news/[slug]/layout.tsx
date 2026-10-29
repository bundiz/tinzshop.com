import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import { decodeSlugParam } from '../news-routes';
import { readNewsArticle } from '../read-news';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

/**
 * The article's title and excerpt as `<title>` and description, or the not-found title for an unknown or
 * hidden slug. In a layout because Next drops a page's metadata when the page calls `notFound()` (D-120).
 */
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const articleSlug = decodeSlugParam(slug);
  const [article, t, tNotFound] = await Promise.all([
    articleSlug === null ? null : readNewsArticle(locale, articleSlug),
    getTranslations({ locale, namespace: 'shop.news.meta' }),
    getTranslations({ locale, namespace: 'shop.notFound.meta' }),
  ]);
  if (article === null) return { title: tNotFound('title') };
  return {
    title: t('articleTitle', { title: article.title }),
    ...(article.excerpt === '' ? {} : { description: article.excerpt }),
  };
}

export default function NewsArticleLayout({ children }: Props) {
  return children;
}
