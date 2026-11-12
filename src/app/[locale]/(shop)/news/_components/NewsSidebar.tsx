import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-class';
import type { NewsTab } from '@/server/services/news/news-read-service';
import { listingHref } from '../../product/listing-url';
import { newsCategoryPath } from '../news-routes';

export type NewsSidebarProps = {
  categories: NewsTab[];
  activeCategorySlug: string | null;
};

/**
 * The sidebar (sticky from `lg`): the "หมวดหมู่ข่าว" panel with real counts, and the navy pre-order panel, whose
 * button links to the listing's pre-order filter, a real page (D-199). The design's "ข่าวยอดนิยม" ranking is left out: nothing records
 * which articles are popular, and a ranking is never made up (D-137).
 */
export default function NewsSidebar({ categories, activeCategorySlug }: NewsSidebarProps) {
  const t = useTranslations('shop.news');
  const locale = useLocale();

  return (
    <aside aria-label={t('sidebar.label')} className="grid gap-4 lg:sticky lg:top-[140px]">
      {categories.length > 0 && (
        <section aria-labelledby="news-categories-title" className="rounded-lg border border-line bg-surface p-[18px] sm:p-6">
          <h2 id="news-categories-title" className="mb-3 text-lg">
            {t('tabs.label')}
          </h2>
          <ul>
            {categories.map((category) => {
              const isActive = category.slug === activeCategorySlug;
              return (
                <li key={category.slug} className="flex items-center justify-between gap-3 text-[15px]">
                  <Link
                    href={newsCategoryPath(locale, category.slug)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-11 min-w-0 items-center [overflow-wrap:anywhere] hover:text-brand sm:min-h-9 ${
                      isActive ? 'font-bold text-brand' : 'text-ink-2'
                    }`}
                  >
                    {category.name}
                  </Link>
                  <span className="text-sm text-muted">{category.count}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section
        aria-labelledby="news-cta-title"
        className="rounded-lg border-0 bg-navy p-[18px] text-on-navy sm:p-6"
      >
        <h2 id="news-cta-title" className="mb-3 text-lg text-white">
          {t('sidebar.preOrderTitle')}
        </h2>
        <p className="mb-3.5 text-on-navy-2">{t('sidebar.preOrderText')}</p>
        <Link href={listingHref(locale, { preOrder: true })} className={buttonClass({ variant: 'buy', block: true })}>
          {t('sidebar.preOrderAction')}
        </Link>
      </section>
    </aside>
  );
}
