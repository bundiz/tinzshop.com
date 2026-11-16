'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId, useRef, useState } from 'react';

import { buttonClass } from '@/components/ui/button-class';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import type { NewsAdminState } from '@/server/controllers/news/news-admin-controller';
import type { ProductPickerHit } from '@/server/services/catalogue/product-search-service';
import type { NewsAdminStatus } from '@/server/services/news/news-admin-service';
import { saveArticleAction, searchProductsAction, trashArticleAction } from '../actions';
import { bodyOrEmpty } from './body-roundtrip';
import ProductPicker from './ProductPicker';
import RichTextEditor from './RichTextEditor';
import TagInput from './TagInput';

type Translation = { title: string; excerpt: string; bodyHtml: string };

/** One article as the editor needs it, serialisable (dates are ISO strings). Null `article` means a new one. */
export type EditorArticle = {
  id: string;
  slug: string;
  /** Derived: a published article with a future date is `scheduled` (D-130). */
  status: NewsAdminStatus;
  publishedAt: string | null;
  bylineName: string;
  featuredImageUrl: string | null;
  th: Translation;
  en: Translation | null;
  categoryIds: string[];
  tagNames: string[];
  products: ProductPickerHit[];
};

export type ArticleEditorProps = {
  locale: string;
  article: EditorArticle | null;
  /** The listed categories, named in the viewer's language. */
  categories: { id: string; name: string }[];
  /** The byline a new article starts with: the editor's first name. */
  defaultByline: string;
  /** Override the Server Actions in tests. */
  actions?: {
    save: (previous: NewsAdminState, formData: FormData) => Promise<NewsAdminState>;
    trash: (previous: NewsAdminState, formData: FormData) => Promise<NewsAdminState>;
    search: (query: string, locale: string) => Promise<ProductPickerHit[]>;
  };
};

const IDLE: NewsAdminState = { status: 'idle' };
const EMPTY: Translation = { title: '', excerpt: '', bodyHtml: '' };
const BANGKOK_OFFSET_MS = 7 * 3_600_000;

/** An instant as the browser's date-time input wants it: Bangkok local, `YYYY-MM-DDTHH:mm` (Thailand has no daylight saving). */
function toBangkokLocal(iso: string): string {
  return new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
}

const INPUT = 'min-h-11 w-full rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-ink';
const PANEL = 'rounded-md border border-line bg-surface p-4';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={PANEL}>
      <h2 className="mb-3 font-head text-base font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The news editor (the mockup's `.ed`): the Thai and English versions, the body editor and the side panels for publishing,
 * categories, tags and related products. One form: the buttons submit with their `action` (R7: a published or scheduled
 * article gets "Update" and "Unpublish", never "Save draft", because a draft save would take it off the site). Left out
 * of the mockup: the image button, the cover upload, the meta description and Google preview, visibility, the edit history
 * and "send for review" (plan 016, Task 9; D-237, D-129).
 */
export default function ArticleEditor({ locale, article, categories, defaultByline, actions }: ArticleEditorProps) {
  const t = useTranslations('admin.news');
  const e = useTranslations('admin.news.editor');
  const errors = useTranslations('admin.news.error');
  const router = useRouter();
  const saveAction = actions?.save ?? saveArticleAction;
  const trashAction = actions?.trash ?? trashArticleAction;
  const search = actions?.search ?? searchProductsAction;

  const [saved, formAction, saving] = useActionState(saveAction, IDLE);
  const [trashed, trashFormAction] = useActionState(trashAction, IDLE);
  const [language, setLanguage] = useState<'th' | 'en'>('th');
  const [th, setTh] = useState<Translation>(article?.th ?? EMPTY);
  const [en, setEn] = useState<Translation>(article?.en ?? EMPTY);
  // A body the editor cannot keep is saved exactly as stored, whatever the editor reports (the lock decides, not onChange).
  const [locked, setLocked] = useState({ th: false, en: false });
  const [slug, setSlug] = useState(article?.slug ?? '');
  const [byline, setByline] = useState(article?.bylineName ?? defaultByline);
  const [categoryIds, setCategoryIds] = useState<string[]>(article?.categoryIds ?? []);
  const [tags, setTags] = useState<string[]>(article?.tagNames ?? []);
  const [products, setProducts] = useState<ProductPickerHit[]>(article?.products ?? []);
  const [when, setWhen] = useState<'now' | 'later'>(article?.status === 'scheduled' ? 'later' : 'now');
  const [publishAt, setPublishAt] = useState(article?.publishedAt && article.status === 'scheduled' ? toBangkokLocal(article.publishedAt) : '');
  const [confirmTrash, setConfirmTrash] = useState(false);
  const trashDialog = useRef<HTMLDivElement>(null);
  const trashOpener = useRef<HTMLButtonElement>(null);
  const trashTitleId = useId();
  useModalDialog({ open: confirmTrash, onClose: () => setConfirmTrash(false), containerRef: trashDialog, returnFocusRef: trashOpener });

  const status = article?.status ?? 'draft';
  const isPublished = status === 'published' || status === 'scheduled';
  const publishable = !(status === 'published');

  // A first save moves to the new article's own editor page; a trashed article returns to the list.
  useEffect(() => {
    if (saved.status === 'saved' && article === null) router.replace(`/${locale}/admin/news/${saved.id}`);
  }, [saved, article, locale, router]);
  useEffect(() => {
    if (trashed.status === 'done') router.replace(`/${locale}/admin/news`);
    else if (trashed.status === 'error') setConfirmTrash(false);
  }, [trashed, locale, router]);

  const searchProducts = (query: string) => search(query, locale);
  // After a save the page is read again, so the message goes by what was asked: a chosen future time schedules.
  const savedMessage =
    saved.status === 'saved'
      ? e(`saved.${saved.action === 'publish' ? (when === 'later' && publishAt !== '' ? 'scheduled' : 'publish') : saved.action}`)
      : null;
  const failure = saved.status === 'error' ? saved : trashed.status === 'error' ? trashed : null;

  return (
    <>
      <form action={formAction} aria-label={e('form')} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        {article ? <input type="hidden" name="id" value={article.id} /> : null}
        <input type="hidden" name="thBodyHtml" value={locked.th ? (article?.th.bodyHtml ?? '') : bodyOrEmpty(th.bodyHtml)} />
        <input type="hidden" name="enBodyHtml" value={locked.en ? (article?.en?.bodyHtml ?? '') : bodyOrEmpty(en.bodyHtml)} />

        <div className="flex flex-wrap items-center gap-2.5">
          <a href={`/${locale}/admin/news`} className="inline-flex min-h-11 items-center font-semibold text-ink-2 hover:text-ink">
            ‹ {e('back')}
          </a>
          <p role="status" aria-live="polite" className="font-medium text-ok-ink">
            {savedMessage}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            {article ? (
              <a href={`/${locale}/admin/news/${article.id}/preview`} target="_blank" rel="noopener" className={buttonClass({ variant: 'line' })}>
                {e('button.preview')}
              </a>
            ) : null}
            {isPublished ? (
              <>
                <button type="submit" disabled={saving} name="action" value="unpublish" className={buttonClass({ variant: 'line' })}>
                  {e('button.unpublish')}
                </button>
                <button type="submit" disabled={saving} name="action" value="publish" className={buttonClass({ variant: 'buy' })}>
                  {e('button.update')}
                </button>
              </>
            ) : (
              <>
                <button type="submit" disabled={saving} name="action" value="draft" className={buttonClass({ variant: 'line' })}>
                  {e('button.saveDraft')}
                </button>
                <button type="submit" disabled={saving} name="action" value="publish" className={buttonClass({ variant: 'buy' })}>
                  {e('button.publish')}
                </button>
              </>
            )}
          </div>
        </div>

        {failure ? (
          <p role="alert" className="rounded-sm bg-ns-soft p-3 font-medium text-ns-ink">
            {errors(failure.errorKey)}
          </p>
        ) : null}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div role="group" aria-label={e('languagesLabel')} className="inline-flex gap-0.5 rounded-sm bg-sunk p-[3px]">
                {(['th', 'en'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    lang={code}
                    aria-pressed={language === code}
                    onClick={() => setLanguage(code)}
                    className="min-h-11 min-w-20 cursor-pointer rounded-md px-3 font-semibold text-muted aria-pressed:bg-white aria-pressed:text-ink aria-pressed:shadow-1"
                  >
                    {e(code)}
                  </button>
                ))}
              </div>
              {language === 'en' ? <p className="text-sm text-muted">{e('enHint')}</p> : null}
            </div>

            {(['th', 'en'] as const).map((code) => {
              const value = code === 'th' ? th : en;
              const set = code === 'th' ? setTh : setEn;
              return (
                <div key={code} hidden={language !== code} className="grid gap-3">
                  <div>
                    <label htmlFor={`${code}-title`} className="sr-only">
                      {e('titleLabel')}
                    </label>
                    <input
                      id={`${code}-title`}
                      name={`${code}Title`}
                      lang={code}
                      value={value.title}
                      onChange={(event) => set({ ...value, title: event.target.value })}
                      placeholder={e('titlePlaceholder')}
                      className="min-h-14 w-full rounded-sm border-[1.5px] border-line-2 bg-surface px-3 font-head text-[22px] font-bold text-ink"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${code}-excerpt`} className="mb-1 block font-semibold text-ink">
                      {e('excerptLabel')}
                    </label>
                    <textarea
                      id={`${code}-excerpt`}
                      name={`${code}Excerpt`}
                      lang={code}
                      rows={2}
                      value={value.excerpt}
                      onChange={(event) => set({ ...value, excerpt: event.target.value })}
                      aria-describedby={`${code}-excerpt-hint`}
                      className={`${INPUT} py-2`}
                    />
                    <p id={`${code}-excerpt-hint`} className="mt-1 text-sm text-muted">
                      {e('excerptHint')}
                    </p>
                  </div>
                  <RichTextEditor
                    label={`${e('bodyLabel')} (${e(code)})`}
                    initialHtml={value.bodyHtml}
                    onLockedChange={(isLocked) => setLocked((previous) => ({ ...previous, [code]: isLocked }))}
                    onChange={(html) => set((previous) => ({ ...previous, bodyHtml: html }))}
                    searchProducts={searchProducts}
                  />
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="slug" className="font-semibold text-ink-2">
                {e('slugPrefix')}
              </label>
              <input
                id="slug"
                name="slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                aria-describedby="slug-hint"
                className={`${INPUT} min-w-[220px] flex-1`}
              />
              <span className="sr-only">{e('slugLabel')}</span>
              <p id="slug-hint" className="w-full text-sm text-muted">
                {e('slugHint')}
              </p>
            </div>
          </div>

          <aside className="grid gap-3">
            <Panel title={e('panel.publish')}>
              <dl className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-2">{e('state')}</dt>
                  <dd>
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                        status === 'published' ? 'bg-ok-soft text-ok-ink' : status === 'scheduled' ? 'bg-brand-soft text-brand-dark' : 'bg-sunk text-ink-2'
                      }`}
                    >
                      {t(`status.${status}`)}
                    </span>
                  </dd>
                </div>
                {publishable ? (
                  <div>
                    <dt>
                      <label htmlFor="when" className="text-ink-2">
                        {e('when')}
                      </label>
                    </dt>
                    <dd className="mt-1">
                      <select id="when" value={when} onChange={(event) => setWhen(event.target.value as 'now' | 'later')} className={INPUT}>
                        <option value="now">{e('whenNow')}</option>
                        <option value="later">{e('whenLater')}</option>
                      </select>
                      {when === 'later' ? (
                        <div className="mt-2">
                          <label htmlFor="publish-at" className="mb-1 block text-sm text-ink-2">
                            {e('whenAt')}
                          </label>
                          <input id="publish-at" name="publishAt" type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} className={INPUT} />
                        </div>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>
                    <label htmlFor="byline" className="text-ink-2">
                      {e('byline')}
                    </label>
                  </dt>
                  <dd className="mt-1">
                    <input id="byline" name="bylineName" value={byline} onChange={(event) => setByline(event.target.value)} maxLength={200} className={INPUT} />
                  </dd>
                </div>
              </dl>
              {article?.featuredImageUrl ? (
                <figure className="mt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- old-site URL, no image pipeline yet (D-127) */}
                  <img src={article.featuredImageUrl} alt="" className="h-auto w-full rounded-sm bg-sunk" />
                  <figcaption className="mt-1 text-sm text-muted">{e('featured')}</figcaption>
                </figure>
              ) : null}
              {article ? (
                <button ref={trashOpener} type="button" onClick={() => setConfirmTrash(true)} className="mt-3 inline-flex min-h-11 cursor-pointer items-center font-semibold text-sale hover:underline">
                  {e('button.trash')}
                </button>
              ) : null}
            </Panel>

            <Panel title={e('panel.categories')}>
              {categories.length === 0 ? (
                <p className="text-muted">{e('categoriesEmpty')}</p>
              ) : (
                <ul className="grid gap-1">
                  {categories.map((category) => (
                    <li key={category.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-ink">
                        <input
                          type="checkbox"
                          name="categoryId"
                          value={category.id}
                          checked={categoryIds.includes(category.id)}
                          onChange={(event) =>
                            setCategoryIds((ids) => (event.target.checked ? [...ids, category.id] : ids.filter((id) => id !== category.id)))
                          }
                          className="size-5 accent-brand"
                        />
                        {category.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={e('panel.tags')}>
              <TagInput tags={tags} onChange={setTags} />
            </Panel>

            <Panel title={e('panel.products')}>
              <ProductPicker selected={products} onChange={setProducts} search={searchProducts} />
            </Panel>
          </aside>
        </div>
      </form>

      {article ? (
        <form id="trash-form" action={trashFormAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={article.id} />
        </form>
      ) : null}
      {confirmTrash ? (
        <div className="fixed inset-0 z-60 grid place-items-center bg-ink/50 p-4">
          <div ref={trashDialog} role="alertdialog" aria-modal="true" aria-labelledby={trashTitleId} className="w-full max-w-[420px] rounded-md bg-surface p-5 shadow-1">
            <h2 id={trashTitleId} className="font-head text-xl font-bold text-ink">
              {e('confirm.trashTitle')}
            </h2>
            <p className="mt-2 text-ink-2">{e('confirm.trashText')}</p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" onClick={() => setConfirmTrash(false)} className={buttonClass({ variant: 'line' })}>
                {e('confirm.cancel')}
              </button>
              <button type="submit" form="trash-form" className={buttonClass({ variant: 'buy' })}>
                {e('confirm.trash')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
