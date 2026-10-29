import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { readArticlesMenu } from '../../../_components/read-articles-menu';
import NewsListView from '../../_components/NewsListView';
import { decodeSlugParam, parsePageParam } from '../../news-routes';
import { readNewsList } from '../../read-news';

// Articles go live by `published_at`, so the list is read on every request.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * One news category and its descendants' articles, the same layout as the list (plan 012). The slug
 * arrives percent-encoded and is decoded once; an unknown one, or a page past the end, is a 404.
 */
export default async function NewsCategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const categorySlug = decodeSlugParam(slug);
  const page = parsePageParam((await searchParams).page);
  if (categorySlug === null || page === null) notFound();
  // The header's menu is read alongside, as on the home and product pages.
  const [list, articlesMenu] = await Promise.all([readNewsList(locale, categorySlug, page), readArticlesMenu(locale)]);
  if (list === null) notFound();

  return <NewsListView list={list} articlesMenu={articlesMenu} />;
}
