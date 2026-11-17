'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

import { buttonClass } from '@/components/ui/button-class';
import type { NewsAdminErrorKey, NewsCategoryState } from '@/server/controllers/news/news-admin-controller';
import type { NewsCategoryOption } from '@/server/services/news/news-admin-service';
import { categoryName } from '../_lib/categories';

export type AddCategoryProps = {
  locale: string;
  /** `createCategoryAction`, or a stand-in in tests. */
  create: (locale: string, input: { thName: string; enName: string }) => Promise<NewsCategoryState>;
  /** A new category, or a listed one that already had the Thai name: the editor lists it and ticks it. */
  onAdded: (category: NewsCategoryOption) => void;
};

const INPUT = 'min-h-11 w-full rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-ink';

/**
 * "+ เพิ่มหมวดหมู่" in the editor's categories panel (D-254): a small inline form for a Thai name and an optional English
 * one. It sits inside the article's form, so it is not a `<form>` and its inputs have no `name`: nothing of it is posted
 * with the article. Enter adds, Escape cancels; focus goes to the first field on open and back to the button on close.
 */
export default function AddCategory({ locale, create, onAdded }: AddCategoryProps) {
  const t = useTranslations('admin.news.editor.addCategory');
  const errors = useTranslations('admin.news.error');
  const [open, setOpen] = useState(false);
  const [thName, setThName] = useState('');
  const [enName, setEnName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<NewsAdminErrorKey | 'failed' | null>(null);
  const [notice, setNotice] = useState('');
  const opener = useRef<HTMLButtonElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    if (open) firstField.current?.focus();
  }, [open]);

  function close(): void {
    setOpen(false);
    setThName('');
    setEnName('');
    setError(null);
    opener.current?.focus();
  }

  async function add(): Promise<void> {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const state = await create(locale, { thName, enName });
      if (state.status === 'error') {
        setError(state.errorKey);
        return;
      }
      onAdded(state.category);
      setNotice(t(state.status === 'created' ? 'added' : 'existing', { name: categoryName(state.category.names, locale) }));
      close();
    } catch {
      // A lost connection or a server failure: the form stays open with what was typed, so it can be tried again.
      setError('failed');
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      // Without this, Enter would submit the article's form.
      event.preventDefault();
      void add();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  return (
    <div className="mt-2">
      <button
        ref={opener}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => (open ? close() : setOpen(true))}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-[15px] font-semibold text-brand-dark hover:underline sm:min-h-[34px]"
      >
        <span aria-hidden="true">+</span>
        {t('open')}
      </button>
      <p role="status" aria-live="polite" className="text-sm text-ok-ink">
        {notice}
      </p>
      {open ? (
        <div id={`${id}-panel`} role="group" aria-label={t('open')} className="mt-1 grid gap-2 rounded-sm bg-sunk p-3">
          <div>
            <label htmlFor={`${id}-th`} className="mb-1 block text-sm font-semibold text-ink">
              {t('thName')}
            </label>
            <input
              ref={firstField}
              id={`${id}-th`}
              lang="th"
              value={thName}
              onChange={(event) => setThName(event.target.value)}
              onKeyDown={onKeyDown}
              maxLength={100}
              aria-invalid={error !== null && error !== 'failed'}
              aria-describedby={`${id}-hint`}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor={`${id}-en`} className="mb-1 block text-sm font-semibold text-ink">
              {t('enName')}
            </label>
            <input
              id={`${id}-en`}
              lang="en"
              value={enName}
              onChange={(event) => setEnName(event.target.value)}
              onKeyDown={onKeyDown}
              maxLength={100}
              className={INPUT}
            />
          </div>
          <p id={`${id}-hint`} className="text-sm text-muted">
            {t('hint')}
          </p>
          {error !== null ? (
            <p role="alert" className="rounded-sm bg-ns-soft p-2 text-sm font-medium text-ns-ink">
              {error === 'failed' ? t('failed') : errors(error)}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void add()}
              className={`${buttonClass({ variant: 'brand', size: 'adminSm' })} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {t('submit')}
            </button>
            <button type="button" onClick={close} className={buttonClass({ variant: 'line', size: 'adminSm' })}>
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
