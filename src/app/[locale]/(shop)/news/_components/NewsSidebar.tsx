import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { NewsTab } from '@/server/services/news/news-read-service';
import { newsCategoryPath } from '../news-routes';

export type NewsSidebarProps = {
  categories: NewsTab[];
  activeCategorySlug: string | null;
};

/**
 * The design's sidebar: the "หมวดหมู่ข่าว" panel with real counts, and the pre-order panel, whose button is
 * inert until a pre-order list exists (D-124). The design's "ข่าวยอดนิยม" ranking is left out: nothing records
 * which articles are popular, and a ranking is never made up (D-137).
 */
export default function NewsSidebar({ categories, activeCategorySlug }: NewsSidebarProps) {
  const t = useTranslations('shop.news');
  const locale = useLocale();

  return (
    <aside aria-label={t('sidebar.label')} className="grid gap-4">
      {categories.length > 0 && (
        <section aria-labelledby="news-categories-title" className="rounded-(--radius) bg-bg p-[18px]">
          <h2 id="news-categories-title" className="mb-3 text-base">
            {t('tabs.label')}
          </h2>
          <ul>
            {categories.map((category) => {
              const isActive = category.slug === activeCategorySlug;
              return (
                <li key={category.slug} className="flex items-center justify-between gap-3 text-sm">
                  <Link
                    href={newsCategoryPath(locale, category.slug)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`block min-w-0 py-1 [overflow-wrap:anywhere] hover:text-primary ${
                      isActive ? 'font-bold text-primary' : ''
                    }`}
                  >
                    {category.name}
                  </Link>
                  <span className="text-xs text-text-subtle">{category.count}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section
        aria-labelledby="news-cta-title"
        className="rounded-(--radius) bg-[linear-gradient(135deg,#fff2d1_0%,#ffd98a_100%)] p-[18px] text-[#5a3a00]"
      >
        <h2 id="news-cta-title" className="mb-3 text-base">
          {t('sidebar.preOrderTitle')}
        </h2>
        <p className="mb-3.5 text-sm">{t('sidebar.preOrderText')}</p>
        <a
          href="#"
          className="flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-[15px] leading-[1.3] font-bold text-white hover:bg-primary-dark"
        >
          {t('sidebar.preOrderAction')}
        </a>
      </section>
    </aside>
  );
}
