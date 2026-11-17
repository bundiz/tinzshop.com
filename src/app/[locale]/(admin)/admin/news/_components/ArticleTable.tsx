'use client';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';

import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RowActionsMenu from '@/components/ui/RowActionsMenu';
import type { NewsAdminState } from '@/server/controllers/news/news-admin-controller';
import type { NewsAdminStatus } from '@/server/services/news/news-admin-service';
import { restoreArticleAction, trashArticleAction } from '../actions';

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
  /** Override the Server Actions in tests. */
  actions?: {
    trash: (previous: NewsAdminState, formData: FormData) => Promise<NewsAdminState>;
    restore: (previous: NewsAdminState, formData: FormData) => Promise<NewsAdminState>;
  };
};

type Actions = NonNullable<ArticleTableProps['actions']>;

const IDLE: NewsAdminState = { status: 'idle' };

const PILL: Record<NewsAdminStatus, string> = {
  published: 'bg-ok-soft text-ok-ink',
  scheduled: 'bg-brand-soft text-brand-dark',
  draft: 'bg-sunk text-ink-2',
};

/**
 * A row's "⋯" menu (D-261): แก้ไข (a link to the editor) and ย้ายไปถังขยะ, which asks in a `ConfirmDialog` with the
 * editor's copy and then posts the row's trash form; in the trash, only กู้คืน, which posts the restore form at once.
 */
function RowActions({ locale, row, title, actions }: { locale: string; row: ArticleTableRow; title: string; actions: Actions }) {
  const t = useTranslations('admin.news');
  const e = useTranslations('admin.news.editor');
  const errors = useTranslations('admin.news.error');
  const [trashed, trashAction, trashing] = useActionState(actions.trash, IDLE);
  const [restored, restoreAction] = useActionState(actions.restore, IDLE);
  const [confirm, setConfirm] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const restoreForm = useRef<HTMLFormElement>(null);
  const closeConfirm = useCallback(() => setConfirm(false), []);
  // The confirm stays up while the action runs, so its submit button is still in the page when the browser submits; it closes on the result.
  useEffect(() => {
    if (trashed.status !== 'idle') setConfirm(false);
  }, [trashed]);
  const trashFormId = `trash-${row.id}`;
  const failure = trashed.status === 'error' ? trashed : restored.status === 'error' ? restored : null;
  return (
    <>
      {row.trashed ? (
        <form id={`restore-${row.id}`} ref={restoreForm} action={restoreAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={row.id} />
        </form>
      ) : (
        <form id={trashFormId} action={trashAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={row.id} />
        </form>
      )}
      <RowActionsMenu
        label={t('menu.label', { title })}
        buttonRef={menuButton}
        items={
          row.trashed
            ? [{ key: 'restore', label: t('restore'), icon: 'undo', onSelect: () => restoreForm.current?.requestSubmit() }]
            : [
                { key: 'edit', label: t('menu.edit'), icon: 'edit', href: `/${locale}/admin/news/${row.id}` },
                { key: 'trash', label: e('button.trash'), icon: 'trash', tone: 'danger', onSelect: () => setConfirm(true) },
              ]
        }
      />
      {failure === null ? null : (
        <p role="alert" className="mt-1 ml-auto max-w-[260px] text-left text-sm font-medium whitespace-normal text-sale">
          {errors(failure.errorKey)}
        </p>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={closeConfirm}
        title={e('confirm.trashTitle')}
        text={e('confirm.trashText')}
        confirmLabel={e('confirm.trash')}
        cancelLabel={e('confirm.cancel')}
        tone="danger"
        icon="trash"
        form={trashFormId}
        pending={trashing}
        returnFocusRef={menuButton}
      />
    </>
  );
}

/**
 * The news list (the mockup's `.tbl`): title, categories, author, the languages present, status and date, and a row menu
 * (D-261). A title links to the editor, except in the trash. The mockup's reader counts and its eye icon are left out
 * (plan 016, Task 9; D-239).
 */
export default function ArticleTable({ locale, rows, actions }: ArticleTableProps) {
  const t = useTranslations('admin.news');
  const format = useFormatter();
  const rowActions: Actions = { trash: actions?.trash ?? trashArticleAction, restore: actions?.restore ?? restoreArticleAction };

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
            <th scope="col" className="w-px p-3">
              <span className="sr-only">{t('columns.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const title = row.title === '' ? t('untitled') : row.title;
            return (
              <tr key={row.id} className="border-b border-line align-middle last:border-b-0">
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
                <td className="py-2 pr-2 pl-3 text-right">
                  <RowActions locale={locale} row={row} title={title} actions={rowActions} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
