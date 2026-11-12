import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import ProductBadge from '@/components/domain/ProductBadge';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import type { NewsArticleDetail } from '@/server/services/news/news-read-service';
import SiteFooter from '../../../_components/SiteFooter';
import type { ArticlesMenuEntry } from '../../../_components/articles-menu';
import SiteHeader from '../../../_components/SiteHeader';
import NewsCardSection from '../../_components/NewsCardSection';
import { newsArticlePath, newsCategoryPath, newsListPath } from '../../news-routes';
import ArticleBody from './ArticleBody';

export type NewsArticleViewProps = {
  article: NewsArticleDetail;
  /** The header's "บทความ" menu (`readArticlesMenu`). */
  articlesMenu: ArticlesMenuEntry[];
  /** The signed-in customer for the header (`readCurrentCustomer`), or null. */
  customer?: { firstName: string } | null;
};

/**
 * One news article in the site header and footer (spec 2026-10-29 §6, D-138): breadcrumb, category labels,
 * title, byline and date, the featured image (eager, D-123), the stored body in a reading column, and
 * "ข่าวที่เกี่ยวข้อง". It follows the redesign's panel and type (plan 015).
 */
export default function NewsArticleView({ article, articlesMenu, customer = null }: NewsArticleViewProps) {
  const t = useTranslations('shop.news');
  const locale = useLocale();
  const byline = t('byline', { name: article.bylineName ?? t('bylineFallback') });

  return (
    <>
      <SiteHeader path={newsArticlePath(locale, article.slug).slice(locale.length + 1)} activeNav="news" articlesMenu={articlesMenu} customer={customer} />
      <main id="main" className="pb-10 sm:pb-16">
        <div className="wrap">
          <Breadcrumbs
            label={t('breadcrumb.label')}
            items={[
              { label: t('breadcrumb.home'), href: `/${locale}` },
              { label: t('title'), href: newsListPath(locale) },
              { label: article.title },
            ]}
          />

          <article aria-labelledby="article-title" className="mt-3 rounded-lg border border-line bg-surface p-[18px] sm:p-8">
            <div className="mx-auto max-w-[760px]">
              {article.categories.length > 0 && (
                <ul aria-label={t('article.categoriesLabel')} className="mb-2 flex flex-wrap gap-1.5">
                  {article.categories.map((category) => (
                    <li key={category.slug}>
                      <Link
                        href={newsCategoryPath(locale, category.slug)}
                        className="inline-flex min-h-11 items-center sm:min-h-0"
                      >
                        <ProductBadge tone="other">{category.name}</ProductBadge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <h1 id="article-title" className="font-head text-[clamp(24px,3vw,32px)] leading-[1.35] font-bold [overflow-wrap:anywhere]">
                {article.title}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted">
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
                  className="mt-4 h-auto w-full rounded-md bg-sunk"
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
