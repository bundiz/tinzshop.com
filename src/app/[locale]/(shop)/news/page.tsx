import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import NewsListView from './_components/NewsListView';
import { parsePageParam } from './news-routes';
import { readNewsList } from './read-news';

// Articles go live by `published_at`, so the list is read on every request.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** Every live article, newest first, 12 a page (`?page=n`), as `design/news.html` (plan 012). */
export default async function NewsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const page = parsePageParam((await searchParams).page);
  if (page === null) notFound();
  const list = await readNewsList(locale, undefined, page);
  if (list === null) notFound();

  return <NewsListView list={list} />;
}
