import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import type { NewsListPage } from '@/server/services/news/news-read-service';
import SiteFooter from '../../_components/SiteFooter';
import type { ArticlesMenuEntry } from '../../_components/articles-menu';
import SiteHeader from '../../_components/SiteHeader';
import { newsCategoryPath, newsListPath } from '../news-routes';
import NewsFeature from './NewsFeature';
import NewsGrid from './NewsGrid';
import NewsSidebar from './NewsSidebar';
import NewsTabs from './NewsTabs';
import Pagination from './Pagination';

export type NewsListViewProps = {
  list: NewsListPage;
  /** The header's "บทความ" menu (`readArticlesMenu`). */
  articlesMenu: ArticlesMenuEntry[];
};

/** How many of page 1's articles go to the feature block (ruling R1, D-134); the rest fill the grid. */
const FEATURE_COUNT = 3;

/**
 * The news list and category pages, laid out as `design/news.html`: breadcrumb, title, category tabs, the
 * feature block (page 1 only), the "ข่าวล่าสุด" grid and pagination beside the sidebar, inside the site header
 * and footer.
 */
export default function NewsListView({ list, articlesMenu }: NewsListViewProps) {
  const t = useTranslations('shop.news');
  const locale = useLocale();
  const category = list.activeCategorySlug;
  const basePath = category === null ? newsListPath(locale) : newsCategoryPath(locale, category);
  const pathWithoutLocale = basePath.slice(locale.length + 1) + (list.page > 1 ? `?page=${list.page}` : '');
  const feature = list.page === 1 ? list.items.slice(0, FEATURE_COUNT) : [];
  const grid = list.page === 1 ? list.items.slice(FEATURE_COUNT) : list.items;
  const chevron = <Icon name="chevRight" className="size-4" />;

  return (
    <>
      <SiteHeader path={pathWithoutLocale} activeNav="news" articlesMenu={articlesMenu} />
      <main className="pt-4 pb-10">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6">
          <nav aria-label={t('breadcrumb.label')} className="py-3 text-[13px] text-text-subtle">
            <ol className="flex flex-wrap items-center gap-1">
              <li className="flex items-center gap-1">
                <Link href={`/${locale}`} className="hover:text-primary">
                  {t('breadcrumb.home')}
                </Link>
                {chevron}
              </li>
              {list.activeCategoryName === null ? (
                <li aria-current="page" className="text-text">
                  {t('title')}
                </li>
              ) : (
                <>
                  <li className="flex items-center gap-1">
                    <Link href={newsListPath(locale)} className="hover:text-primary">
                      {t('title')}
                    </Link>
                    {chevron}
                  </li>
                  <li aria-current="page" className="min-w-0 text-text [overflow-wrap:anywhere]">
                    {list.activeCategoryName}
                  </li>
                </>
              )}
            </ol>
          </nav>

          <div className="mb-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl [overflow-wrap:anywhere]">{list.activeCategoryName ?? t('title')}</h1>
            <span className="text-sm text-text-subtle">{t('subtitle')}</span>
          </div>

          <NewsTabs categories={list.categories} activeCategorySlug={category} />
          <NewsFeature cards={feature} />

          <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <NewsGrid
              cards={grid}
              // Page 1 with every article in the feature block has an empty grid but is not empty.
              emptyText={feature.length > 0 ? '' : t(category === null ? 'empty' : 'categoryEmpty')}
              hideWhenEmpty={feature.length > 0}
            >
              <Pagination basePath={basePath} page={list.page} totalPages={list.totalPages} />
            </NewsGrid>
            <NewsSidebar categories={list.categories} activeCategorySlug={category} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
