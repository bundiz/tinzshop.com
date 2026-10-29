import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { NewsTab } from '@/server/services/news/news-read-service';
import { newsCategoryPath, newsListPath } from '../news-routes';

export type NewsTabsProps = {
  /** Categories with live articles, most first, each with its count. */
  categories: NewsTab[];
  /** The category being shown, or null on the list of every article ("ทั้งหมด"). */
  activeCategorySlug: string | null;
};

const TAB =
  'flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm hover:border-primary hover:bg-primary-soft hover:text-primary';
const ACTIVE = 'border-primary bg-primary-soft text-primary';
const IDLE = 'border-border bg-bg';

/** The design's `.subcats` pills: "all" plus each category with its article count; the current one is marked. */
export default function NewsTabs({ categories, activeCategorySlug }: NewsTabsProps) {
  const t = useTranslations('shop.news.tabs');
  const locale = useLocale();

  const tab = (key: string, href: string, isActive: boolean, label: string, count?: number) => (
    <li key={key}>
      <Link href={href} aria-current={isActive ? 'page' : undefined} className={`${TAB} ${isActive ? ACTIVE : IDLE}`}>
        {label}
        {count !== undefined && <span className="text-xs text-text-subtle">{count}</span>}
      </Link>
    </li>
  );

  return (
    <nav aria-label={t('label')} className="mb-3">
      <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {tab('all', newsListPath(locale), activeCategorySlug === null, t('all'))}
        {categories.map((category) =>
          tab(
            category.slug,
            newsCategoryPath(locale, category.slug),
            category.slug === activeCategorySlug,
            category.name,
            category.count,
          ),
        )}
      </ul>
    </nav>
  );
}
