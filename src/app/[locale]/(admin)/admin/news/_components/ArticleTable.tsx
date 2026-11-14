'use client';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';

import { buttonClass } from '@/components/ui/button-class';
import type { NewsAdminState } from '@/server/controllers/news/news-admin-controller';
import type { NewsAdminStatus } from '@/server/services/news/news-admin-service';
import { restoreArticleAction } from '../actions';

/** One list row, serialisable: dates are ISO strings so they cross from the server page. */
export type ArticleTableRow = {
  id: string;
  /** The Thai title, or the English one, or empty. */
  title: string;
  categoryNames: string[];
  bylineName: string;
  languages: ('th' | 'en')[];
  status: NewsAdminStatus;
  publishedAt: string | null;
  trashed: boolean;
};

export type ArticleTableProps = {
  locale: string;
  rows: ArticleTableRow[];
  /** Override the Server Action in tests. */
  restore?: (previous: NewsAdminState, formData: FormData) => Promise<NewsAdminState>;
};

const IDLE: NewsAdminState = { status: 'idle' };

const PILL: Record<NewsAdminStatus, string> = {
  published: 'bg-ok-soft text-ok-ink',
  scheduled: 'bg-brand-soft text-brand-dark',
  draft: 'bg-sunk text-ink-2',
};

function RestoreForm({ locale, row, title, action }: { locale: string; row: ArticleTableRow; title: string; action: NonNullable<ArticleTableProps['restore']> }) {
  const t = useTranslations('admin.news');
  const errors = useTranslations('admin.news.error');
  const [state, formAction] = useActionState(action, IDLE);
  return (
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={row.id} />
      <button type="submit" aria-label={t('restoreLabel', { title })} className={`${buttonClass({ variant: 'line' })} min-h-11 px-3.5 text-sm`}>
        {t('restore')}
      </button>
      {state.status === 'error' ? (
        <p role="alert" className="mt-1 text-sm font-medium text-sale">
          {errors(state.errorKey)}
        </p>
      ) : null}
    </form>
  );
}

/**
 * The news list (the mockup's `.tbl`): title, categories, author, the languages present, status and date. A row links to
 * the editor; in the trash it has a restore button instead. The mockup's reader counts and its eye and trash icons are
 * left out (plan 016, Task 9; D-239).
 */
export default function ArticleTable({ locale, rows, restore }: ArticleTableProps) {
  const t = useTranslations('admin.news');
  const format = useFormatter();
  const restoreAction = restore ?? restoreArticleAction;

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-sunk text-sm text-muted">
            {(['title', 'categories', 'author', 'languages', 'status', 'date'] as const).map((column) => (
              <th key={column} scope="col" className="p-3 font-semibold">
                {t(`columns.${column}`)}
              </th>
            ))}
            <th scope="col" className="p-3 font-semibold">
              <span className="sr-only">{t('columns.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const title = row.title === '' ? t('untitled') : row.title;
            return (
              <tr key={row.id} className="border-b border-line align-top last:border-b-0">
                <th scope="row" className="min-w-[280px] p-3 font-semibold text-ink [overflow-wrap:anywhere]">
                  {row.trashed ? (
                    title
                  ) : (
                    <Link href={`/${locale}/admin/news/${row.id}`} className="text-ink hover:text-brand-dark">
                      {title}
                    </Link>
                  )}
                </th>
                <td className="p-3 text-ink-2">{row.categoryNames.join(', ')}</td>
                <td className="p-3 text-ink-2">{row.bylineName}</td>
                <td className="p-3">
                  <span className="flex gap-1">
                    {row.languages.map((language) => (
                      <span key={language} lang={language} className="rounded-full bg-ok-soft px-2 py-0.5 text-[12.5px] font-semibold text-ok-ink">
                        {language.toUpperCase()}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-[13px] font-semibold ${PILL[row.status]}`}>{t(`status.${row.status}`)}</span>
                </td>
                <td className="p-3 whitespace-nowrap text-ink-2">
                  {row.publishedAt === null
                    ? '—'
                    : format.dateTime(new Date(row.publishedAt), row.status === 'scheduled' ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })}
                </td>
                <td className="p-3">{row.trashed ? <RestoreForm locale={locale} row={row} title={title} action={restoreAction} /> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
