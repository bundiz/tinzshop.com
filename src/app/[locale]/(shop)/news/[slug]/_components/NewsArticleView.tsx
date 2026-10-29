import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import type { NewsArticleDetail } from '@/server/services/news/news-read-service';
import SiteFooter from '../../../_components/SiteFooter';
import SiteHeader from '../../../_components/SiteHeader';
import NewsCardSection from '../../_components/NewsCardSection';
import { newsArticlePath, newsCategoryPath, newsListPath } from '../../news-routes';
import ArticleBody from './ArticleBody';

export type NewsArticleViewProps = {
  article: NewsArticleDetail;
};

/**
 * One news article in the site header and footer (spec 2026-10-29 §6, D-138): breadcrumb, category labels,
 * title, byline and date, the featured image (eager, D-123), the stored body in a reading column, and
 * "ข่าวที่เกี่ยวข้อง". There is no design file for it; it follows the site's panels and type.
 */
export default function NewsArticleView({ article }: NewsArticleViewProps) {
  const t = useTranslations('shop.news');
  const locale = useLocale();
  const byline = t('byline', { name: article.bylineName ?? t('bylineFallback') });

  return (
    <>
      <SiteHeader path={newsArticlePath(locale, article.slug).slice(locale.length + 1)} activeNav="news" />
      <main className="pt-4 pb-10">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6">
          <nav aria-label={t('breadcrumb.label')} className="py-3 text-[13px] text-text-subtle">
            <ol className="flex flex-wrap items-center gap-1">
              <li className="flex items-center gap-1">
                <Link href={`/${locale}`} className="hover:text-primary">
                  {t('breadcrumb.home')}
                </Link>
                <Icon name="chevRight" className="size-4" />
              </li>
              <li className="flex items-center gap-1">
                <Link href={newsListPath(locale)} className="hover:text-primary">
                  {t('title')}
                </Link>
                <Icon name="chevRight" className="size-4" />
              </li>
              <li aria-current="page" className="min-w-0 text-text [overflow-wrap:anywhere]">
                {article.title}
              </li>
            </ol>
          </nav>

          <article aria-labelledby="article-title" className="rounded-(--radius) bg-bg p-4 md:p-8">
            <div className="mx-auto max-w-[760px]">
              {article.categories.length > 0 && (
                <ul aria-label={t('article.categoriesLabel')} className="mb-2 flex flex-wrap gap-1.5">
                  {article.categories.map((category) => (
                    <li key={category.slug}>
                      <Link
                        href={newsCategoryPath(locale, category.slug)}
                        className="inline-flex min-h-7 items-center rounded-full bg-primary-soft px-2.5 text-xs font-bold text-primary hover:bg-primary hover:text-white"
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <h1 id="article-title" className="text-2xl leading-[1.45] [overflow-wrap:anywhere] md:text-[28px]">
                {article.title}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px] text-text-subtle">
                <span>{byline}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={article.publishedAt.toISOString()}>{t('date', { date: article.publishedAt })}</time>
              </p>
              {article.featuredImageUrl !== null && (
                // eslint-disable-next-line @next/next/no-img-element -- old-site URL, no image pipeline yet (D-127)
                <img
                  src={article.featuredImageUrl}
                  alt=""
                  loading="eager"
                  className="mt-4 h-auto w-full rounded-(--radius-sm) bg-bg-subtle"
                />
              )}
              <div className="mt-2">
                <ArticleBody html={article.bodyHtml} />
              </div>
            </div>
          </article>

          <NewsCardSection id="related-news" title={t('related.title')} cards={article.related} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
