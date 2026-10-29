import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { readArticlesMenu } from '../../_components/read-articles-menu';
import { decodeSlugParam } from '../news-routes';
import { readNewsArticle } from '../read-news';
import NewsArticleView from './_components/NewsArticleView';

// Articles go live by `published_at`, so the page is read on every request.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

/**
 * One live news article by its slug (plan 012 Task 6). The slug arrives percent-encoded and is decoded once;
 * an unknown, draft, scheduled or deleted one is a 404, rendered by `news/not-found.tsx`.
 */
export default async function NewsArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const articleSlug = decodeSlugParam(slug);
  if (articleSlug === null) notFound();
  const article = await readNewsArticle(locale, articleSlug);
  if (article === null) notFound();

  return <NewsArticleView article={article} articlesMenu={await readArticlesMenu(locale)} />;
}
