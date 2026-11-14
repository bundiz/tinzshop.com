import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { getNewsAdmin } from '@/server/composition-root';
import type { NewsArticleDetail } from '@/server/services/news/news-read-service';
import NewsArticleView from '../../../../../(shop)/news/[slug]/_components/NewsArticleView';
import { readArticlesMenu } from '../../../../../(shop)/_components/read-articles-menu';
import { readCurrentCustomer } from '../../../../../(shop)/_components/read-current-customer';
import { requirePermission } from '../../../../../(admin)/admin/_lib/require-permission';
import { categoryName } from '../../../../../(admin)/admin/news/_lib/categories';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(_props: Props): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/**
 * `/{locale}/admin/news/{id}/preview`: the saved article drawn by the storefront's own article page component, so staff see
 * what a reader will. It lives in its own route group, `(admin-preview)`, so the page is the article alone, without the back-office frame. It shows the last saved version (not what is typed in the editor), a draft or scheduled one too, in
 * the page's language or Thai when that translation does not exist. Needs `news.manage`; never indexed.
 */
export default async function NewsPreviewPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requirePermission(locale, `/admin/news/${id}/preview`, 'news.manage');
  const news = getNewsAdmin();
  const article = await news.get(id);
  if (article === null) notFound();
  const translation = (locale === 'en' ? article.en : article.th) ?? article.th ?? article.en;
  if (translation === null) notFound();

  const categories = await news.categories();
  const detail: NewsArticleDetail = {
    slug: article.slug,
    title: translation.title,
    excerpt: translation.excerpt,
    bylineName: article.bylineName,
    publishedAt: article.publishedAt ?? article.updatedAt,
    featuredImageUrl: article.featuredImageUrl,
    bodyHtml: translation.bodyHtml,
    categories: categories
      .filter((category) => article.categoryIds.includes(category.id))
      .map((category) => ({ slug: category.slug, name: categoryName(category.names, locale) })),
    related: [],
  };
  const [articlesMenu, customer] = await Promise.all([readArticlesMenu(locale as 'th' | 'en'), readCurrentCustomer()]);

  return <NewsArticleView article={detail} articlesMenu={articlesMenu} customer={customer} />;
}
