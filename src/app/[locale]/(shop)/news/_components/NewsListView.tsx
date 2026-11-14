import { useLocale, useTranslations } from 'next-intl';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
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
  /** The signed-in customer for the header (`readCurrentCustomer`), or null. */
  customer?: { firstName: string } | null;
};

/** How many of page 1's articles go to the feature block (ruling R1, D-134); the rest fill the grid. */
const FEATURE_COUNT = 3;

/**
 * The news list and category pages, laid out as the redesign's news page (plan 015): breadcrumb, title, category tabs, the
 * feature block (page 1 only), the "ข่าวล่าสุด" grid and pagination beside the sidebar, inside the site header
 * and footer.
 */
export default function NewsListView({ list, articlesMenu, customer = null }: NewsListViewProps) {
  const t = useTranslations('shop.news');
  const locale = useLocale();
  const category = list.activeCategorySlug;
  const basePath = category === null ? newsListPath(locale) : newsCategoryPath(locale, category);
  const pathWithoutLocale = basePath.slice(locale.length + 1) + (list.page > 1 ? `?page=${list.page}` : '');
  const feature = list.page === 1 ? list.items.slice(0, FEATURE_COUNT) : [];
  const grid = list.page === 1 ? list.items.slice(FEATURE_COUNT) : list.items;

  return (
    <>
      <SiteHeader path={pathWithoutLocale} activeNav="news" articlesMenu={articlesMenu} customer={customer} />
      <main id="main" className="pb-10 sm:pb-16">
        <div className="wrap">
          <Breadcrumbs
            label={t('breadcrumb.label')}
            items={
              list.activeCategoryName === null
                ? [{ label: t('breadcrumb.home'), href: `/${locale}` }, { label: t('title') }]
                : [
                    { label: t('breadcrumb.home'), href: `/${locale}` },
                    { label: t('title'), href: newsListPath(locale) },
                    { label: list.activeCategoryName },
                  ]
            }
          />

          <div className="flex flex-col gap-4 pt-3 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-[clamp(28px,3vw,40px)] font-bold [overflow-wrap:anywhere]">
                {list.activeCategoryName ?? t('title')}
              </h1>
              <p className="mt-1 text-muted">{t('subtitle')}</p>
            </div>
            <div className="min-w-0 lg:max-w-[60%]">
              <NewsTabs categories={list.categories} activeCategorySlug={category} />
            </div>
          </div>

          <NewsFeature cards={feature} />

          <div className="grid grid-cols-1 items-start gap-7 py-[clamp(24px,3vw,28px)] lg:grid-cols-[minmax(0,1fr)_320px]">
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
