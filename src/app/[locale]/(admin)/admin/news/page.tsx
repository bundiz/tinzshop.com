import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button-class';
import { getNewsAdmin } from '@/server/composition-root';
import { ADMIN_PAGE_SIZE, type NewsAdminStatus } from '@/server/services/news/news-admin-service';
import { requirePermission } from '../_lib/require-permission';
import ArticleTable from './_components/ArticleTable';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type Tab = NewsAdminStatus | 'trash' | null;
const TABS: { key: string; status: Tab }[] = [
  { key: 'all', status: null },
  { key: 'published', status: 'published' },
  { key: 'scheduled', status: 'scheduled' },
  { key: 'draft', status: 'draft' },
  { key: 'trash', status: 'trash' },
];

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));

/** The query a link keeps: only the non-empty filters. */
function href(locale: string, params: Record<string, string>): string {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== ''));
  const text = query.toString();
  return `/${locale}/admin/news${text === '' ? '' : `?${text}`}`;
}

const TAB =
  'inline-flex min-h-11 items-center gap-1.5 rounded-sm px-4 font-semibold text-ink-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-dark';
const FIELD = 'min-h-11 rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-ink';

/**
 * `/{locale}/admin/news` (plan 016, Task 9): the articles by status, with a title search and a category filter. Needs
 * `news.manage`, checked here and not left to the layout (D-243). The tab counts ignore the search and the filter; "scheduled"
 * is derived from a future `published_at` by the service (D-130).
 */
export default async function NewsListPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission(locale, '/admin/news', 'news.manage');
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'admin.news' });
  const news = getNewsAdmin();

  const tabParam = first(query.status);
  const tab = TABS.find((entry) => entry.key === tabParam) ?? TABS[0]!;
  const q = first(query.q).trim().slice(0, 100);
  const categories = await news.categories();
  const categoryParam = first(query.category);
  const categoryId = categories.some((category) => category.id === categoryParam) ? categoryParam : '';
  const requested = Number.parseInt(first(query.page), 10);
  const requestedPage = Number.isInteger(requested) && requested >= 1 ? requested : 1;

  const name = (names: { th?: string; en?: string }): string => (locale === 'en' ? (names.en ?? names.th) : (names.th ?? names.en)) ?? '';
  const categoryName = new Map(categories.map((category) => [category.id, name(category.names)]));

  const [counts, listed] = await Promise.all([
    Promise.all(TABS.map(async (entry) => (await news.list({ query: '', status: entry.status, categoryId: null, page: 1 })).total)),
    news.list({ query: q, status: tab.status, categoryId: categoryId === '' ? null : categoryId, page: requestedPage }),
  ]);
  const pages = Math.max(1, Math.ceil(listed.total / ADMIN_PAGE_SIZE));
  const current = Math.min(requestedPage, pages);
  const keep = { status: tab.key === 'all' ? '' : tab.key, q, category: categoryId };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-head text-[24px] font-bold text-ink md:text-[28px]">{t('title')}</h1>
          <p className="mt-1 text-muted">{t('subtitle')}</p>
        </div>
        <Link href={`/${locale}/admin/news/new`} className={buttonClass({ variant: 'brand' })}>
          {t('new')}
        </Link>
      </div>

      <nav aria-label={t('tabsLabel')} className="mb-4 flex flex-wrap gap-1 border-b border-line pb-2">
        {TABS.map((entry, index) => (
          <Link
            key={entry.key}
            href={href(locale, { status: entry.key === 'all' ? '' : entry.key })}
            aria-current={entry.key === tab.key ? 'page' : undefined}
            className={TAB}
          >
            {t(`tab.${entry.key}`)}
            <span className="text-sm font-medium text-muted">({counts[index]})</span>
          </Link>
        ))}
      </nav>

      <form method="get" action={`/${locale}/admin/news`} className="mb-4 flex flex-wrap items-center gap-2.5">
        {keep.status === '' ? null : <input type="hidden" name="status" value={keep.status} />}
        <label htmlFor="news-q" className="sr-only">
          {t('search.label')}
        </label>
        <input id="news-q" type="search" name="q" defaultValue={q} placeholder={t('search.placeholder')} className={`${FIELD} min-w-[220px] flex-1`} />
        <label htmlFor="news-category" className="sr-only">
          {t('filter.category')}
        </label>
        <select id="news-category" name="category" defaultValue={categoryId} className={FIELD}>
          <option value="">{t('filter.allCategories')}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {name(category.names)}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass({ variant: 'line' })}>
          {t('search.submit')}
        </button>
        <p className="ml-auto text-muted" role="status">
          {t('count', { count: listed.total })}
        </p>
      </form>

      {listed.rows.length === 0 ? (
        <p className="rounded-md border border-line bg-surface p-6 text-center text-muted">{t(tab.key === 'trash' ? 'emptyTrash' : 'empty')}</p>
      ) : (
        <ArticleTable
          locale={locale}
          rows={listed.rows.map((row) => ({
            id: row.id,
            title: row.titles.th ?? row.titles.en ?? '',
            categoryNames: row.categoryIds.map((id) => categoryName.get(id) ?? '').filter((value) => value !== ''),
            bylineName: row.bylineName ?? row.lastEditorName ?? '',
            languages: (['th', 'en'] as const).filter((language) => row.titles[language] !== undefined),
            status: row.status,
            publishedAt: row.publishedAt?.toISOString() ?? null,
            trashed: row.deletedAt !== null,
          }))}
        />
      )}

      {pages > 1 ? (
        <nav aria-label={t('pager.label')} className="mt-4 flex items-center justify-center gap-3">
          {current > 1 ? (
            <Link href={href(locale, { ...keep, page: String(current - 1) })} rel="prev" className={buttonClass({ variant: 'line' })}>
              {t('pager.prev')}
            </Link>
          ) : null}
          <span className="text-muted">{t('pager.range', { page: current, pages })}</span>
          {current < pages ? (
            <Link href={href(locale, { ...keep, page: String(current + 1) })} rel="next" className={buttonClass({ variant: 'line' })}>
              {t('pager.next')}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
