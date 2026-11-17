'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';

import { buttonClass } from '@/components/ui/button-class';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { NewsAdminState, NewsCategoryState } from '@/server/controllers/news/news-admin-controller';
import type { ProductPickerHit } from '@/server/services/catalogue/product-search-service';
import type { ArticlePreviewDraft, NewsAdminStatus, NewsCategoryOption } from '@/server/services/news/news-admin-service';
import { createCategoryAction, saveArticleAction, searchProductsAction, trashArticleAction } from '../actions';
import { categoryName } from '../_lib/categories';
import {
  buildPreviewDraft,
  isPreviewMessage,
  isPreviewSession,
  PREVIEW_DEBOUNCE_MS,
  PREVIEW_SESSION_STORAGE_KEY,
  previewChannelName,
  previewPath,
  previewWindowName,
  type PreviewMessage,
} from '../_lib/preview-channel';
import AddCategory from './AddCategory';
import { bodyOrEmpty } from './body-roundtrip';
import DateTimePicker from './DateTimePicker';
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
  /**
   * The listed categories, named in the viewer's language, then the article's own unlisted ones (`unlisted`, D-141):
   * those render checked so a save keeps them, and staff may untick but never newly tick one (D-248).
   */
  categories: { id: string; name: string; unlisted?: boolean }[];
  /** The byline a new article starts with: the editor's first name. */
  defaultByline: string;
  /** Override the Server Actions in tests. */
  actions?: {
    save: (previous: NewsAdminState, formData: FormData) => Promise<NewsAdminState>;
    trash: (previous: NewsAdminState, formData: FormData) => Promise<NewsAdminState>;
    search: (query: string, locale: string) => Promise<ProductPickerHit[]>;
    createCategory?: (locale: string, input: { thName: string; enName: string }) => Promise<NewsCategoryState>;
  };
};

const IDLE: NewsAdminState = { status: 'idle' };
const EMPTY: Translation = { title: '', excerpt: '', bodyHtml: '' };
const BANGKOK_OFFSET_MS = 7 * 3_600_000;

/** An instant as `publishAt` carries it: Bangkok local, `YYYY-MM-DDTHH:mm` (Thailand has no daylight saving). */
function toBangkokLocal(iso: string): string {
  return new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
}

const INPUT = 'min-h-11 w-full rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-ink';
const PANEL = 'rounded-md border border-line bg-surface p-4';
// The admin mockup's `.ltabs` (D-257): a 3px sunk track with 9px corners, 34px tabs with 7px corners, the chosen one
// white. Below `sm` each tab's tap target is 44px tall (5px above and below, D-221).
const SEG_TRACK = 'rounded-[9px] bg-sunk p-[3px]';
const SEG_ITEM =
  'relative min-h-[34px] cursor-pointer rounded-[7px] px-3.5 text-sm font-semibold text-muted transition-colors hover:text-ink max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:-inset-y-[5px]';
// The mockup's `.btn-text btn-sm del-link`: a 34px text button in the sale red.
const TRASH_BUTTON =
  'relative mt-3 -ml-3 inline-flex min-h-[34px] cursor-pointer items-center rounded-[9px] px-3 text-sm font-semibold text-sale transition-colors hover:bg-sunk max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:-inset-y-[5px]';

/** A red star after a label for a field publishing needs (a draft saves without it), with the words for a screen reader. */
function RequiredMark({ note }: { note: string }) {
  return (
    <>
      {' '}
      <span aria-hidden="true" className="text-sale">*</span>
      <span className="sr-only">{note}</span>
    </>
  );
}

function Panel({ title, required, children }: { title: string; required?: string; children: React.ReactNode }) {
  return (
    <section className={PANEL}>
      <h2 className="mb-3 font-head text-base font-bold text-ink">
        {title}
        {required !== undefined ? <RequiredMark note={required} /> : null}
      </h2>
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
  const createCategory = actions?.createCategory ?? createCategoryAction;

  const [saved, formAction, saving] = useActionState(saveAction, IDLE);
  const [trashed, trashFormAction, trashing] = useActionState(trashAction, IDLE);
  // Articles are written in Thai only for now (D-260). A stored English version is not shown and goes back unchanged.
  const language = 'th';
  const [th, setTh] = useState<Translation>(article?.th ?? EMPTY);
  const en: Translation = article?.en ?? EMPTY;
  // A body the editor cannot keep is saved exactly as stored, whatever the editor reports (the lock decides, not onChange).
  const [locked, setLocked] = useState(false);
  const [slug, setSlug] = useState(article?.slug ?? '');
  const [byline, setByline] = useState(article?.bylineName ?? defaultByline);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [categoryIds, setCategoryIds] = useState<string[]>(article?.categoryIds ?? []);
  const [tags, setTags] = useState<string[]>(article?.tagNames ?? []);
  const [products, setProducts] = useState<ProductPickerHit[]>(article?.products ?? []);
  const [when, setWhen] = useState<'now' | 'later'>(article?.status === 'scheduled' ? 'later' : 'now');
  const [publishAt, setPublishAt] = useState(article?.publishedAt && article.status === 'scheduled' ? toBangkokLocal(article.publishedAt) : '');
  // The confirm stays up while the trash runs (its submit button must be in the page when the browser submits); a refusal closes it.
  const [confirmTrash, setConfirmTrash] = useState(false);
  const trashOpener = useRef<HTMLButtonElement>(null);

  const status = article?.status ?? 'draft';
  // A first save has worked and the page is about to move to the new article: a second submit would create a twin.
  const created = saved.status === 'saved' && article === null;
  const busy = saving || created;
  const isPublished = status === 'published' || status === 'scheduled';
  const publishable = !(status === 'published');
  // What a save sends for each body: a locked one exactly as stored (the lock decides, not the editor's change events).
  const thBodyHtml = locked ? (article?.th.bodyHtml ?? '') : bodyOrEmpty(th.bodyHtml);
  const enBodyHtml = en.bodyHtml;

  // The live preview (D-253): the draft as a save would send it, over a channel to the preview tab; nothing is saved.
  const draft = buildPreviewDraft({
    articleId: article?.id ?? null,
    language,
    th,
    en,
    thBodyHtml,
    enBodyHtml,
    slug,
    bylineName: byline,
    categoryIds,
    status,
    storedPublishedAt: article?.publishedAt ?? null,
    when,
    publishAt,
  });
  const draftKey = JSON.stringify(draft);
  const latestDraft = useRef<ArticlePreviewDraft>(draft);
  const previewSession = useRef<string | null>(null);
  const previewChannel = useRef<BroadcastChannel | null>(null);

  const connectPreview = useCallback((session: string): void => {
    const channel = new BroadcastChannel(previewChannelName(session));
    channel.onmessage = (event: MessageEvent) => {
      if (isPreviewMessage(event.data) && event.data.type === 'ready') {
        channel.postMessage({ type: 'draft', draft: latestDraft.current } satisfies PreviewMessage);
      }
    };
    previewSession.current = session;
    previewChannel.current = channel;
  }, []);

  // A session made earlier in this browser tab is picked up again, so the preview follows a new article to its saved page.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(PREVIEW_SESSION_STORAGE_KEY);
    } catch {
      // Storage blocked by the browser: a session lasts as long as this page.
    }
    if (previewChannel.current === null && isPreviewSession(stored)) connectPreview(stored);
    const sayClosed = () => previewChannel.current?.postMessage({ type: 'closed' } satisfies PreviewMessage);
    window.addEventListener('pagehide', sayClosed);
    return () => {
      window.removeEventListener('pagehide', sayClosed);
      sayClosed();
      previewChannel.current?.close();
      previewChannel.current = null;
      previewSession.current = null;
    };
  }, [connectPreview]);

  // Each change goes to the preview 500 ms after typing stops; `draftKey` stands for the draft's content.
  useEffect(() => {
    latestDraft.current = draft;
    const channel = previewChannel.current;
    if (channel === null) return;
    const timer = setTimeout(() => channel.postMessage({ type: 'draft', draft } satisfies PreviewMessage), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the draft is rebuilt each render; its content is the dependency
  }, [draftKey]);

  function openPreview(): void {
    let session = previewSession.current;
    if (session === null) {
      session = crypto.randomUUID();
      connectPreview(session);
      try {
        window.sessionStorage.setItem(PREVIEW_SESSION_STORAGE_KEY, session);
      } catch {
        // Storage blocked by the browser: the preview still works until this page is left.
      }
    }
    window.open(previewPath(locale, session), previewWindowName(session));
  }

  function addCategory(category: NewsCategoryOption): void {
    setCategoryOptions((options) =>
      options.some((option) => option.id === category.id) ? options : [...options, { id: category.id, name: categoryName(category.names, locale) }],
    );
    setCategoryIds((ids) => (ids.includes(category.id) ? ids : [...ids, category.id]));
  }

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
        <input type="hidden" name="thBodyHtml" value={thBodyHtml} />
        <input type="hidden" name="enTitle" value={en.title} />
        <input type="hidden" name="enExcerpt" value={en.excerpt} />
        <input type="hidden" name="enBodyHtml" value={enBodyHtml} />

        <div className="flex flex-wrap items-center gap-2.5">
          <p role="status" aria-live="polite" className="font-medium text-ok-ink">
            {savedMessage}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={openPreview} className={buttonClass({ variant: 'line', size: 'admin' })}>
              {e('button.preview')}
            </button>
            {isPublished ? (
              <>
                <button type="submit" disabled={busy} name="action" value="unpublish" className={buttonClass({ variant: 'line', size: 'admin' })}>
                  {e('button.unpublish')}
                </button>
                <button type="submit" disabled={busy} name="action" value="publish" className={buttonClass({ variant: 'buy', size: 'admin' })}>
                  {e('button.update')}
                </button>
              </>
            ) : (
              <>
                <button type="submit" disabled={busy} name="action" value="draft" className={buttonClass({ variant: 'line', size: 'admin' })}>
                  {e('button.saveDraft')}
                </button>
                <button type="submit" disabled={busy} name="action" value="publish" className={buttonClass({ variant: 'buy', size: 'admin' })}>
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

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 gap-3">
            <div className="grid gap-3">
              <div>
                <label htmlFor="th-title" className="sr-only">
                  {e('titleLabel')}
                </label>
                <input
                  id="th-title"
                  name="thTitle"
                  lang="th"
                  value={th.title}
                  onChange={(event) => setTh({ ...th, title: event.target.value })}
                  placeholder={e('titlePlaceholder')}
                  maxLength={300}
                  className="min-h-14 w-full rounded-sm border-[1.5px] border-line-2 bg-surface px-3 font-head text-[22px] font-bold text-ink"
                />
              </div>
              <div>
                <label htmlFor="th-excerpt" className="mb-1 block font-semibold text-ink">
                  {e('excerptLabel')}
                  <RequiredMark note={e('requiredToPublish')} />
                </label>
                <textarea
                  id="th-excerpt"
                  name="thExcerpt"
                  lang="th"
                  rows={2}
                  value={th.excerpt}
                  onChange={(event) => setTh({ ...th, excerpt: event.target.value })}
                  aria-describedby="th-excerpt-hint"
                  className={`${INPUT} py-2`}
                />
                <p id="th-excerpt-hint" className="mt-1 text-sm text-muted">
                  {e('excerptHint')}
                </p>
              </div>
              <RichTextEditor
                label={e('bodyLabel')}
                initialHtml={th.bodyHtml}
                onLockedChange={setLocked}
                onChange={(html) => setTh((previous) => ({ ...previous, bodyHtml: html }))}
                searchProducts={searchProducts}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="slug" className="font-semibold text-ink-2">
                {e('slugPrefix')}
              </label>
              <input
                id="slug"
                name="slug"
                maxLength={300}
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

          <aside className="grid min-w-0 grid-cols-1 gap-3">
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
                    <dt id="when-label" className="text-ink-2">
                      {e('when')}
                    </dt>
                    <dd className="mt-1">
                      {/* Two choices, so a segmented switch rather than a dropdown; real radios, so the form still sends `when`. */}
                      <div role="radiogroup" aria-labelledby="when-label" className={`grid grid-cols-2 ${SEG_TRACK}`}>
                        {(['now', 'later'] as const).map((choice) => (
                          <label
                            key={choice}
                            className={`${SEG_ITEM} flex items-center justify-center has-checked:bg-white has-checked:text-ink has-checked:shadow-1 has-focus-visible:outline-[3px] has-focus-visible:outline-offset-2 has-focus-visible:outline-ps`}
                          >
                            <input
                              type="radio"
                              name="when"
                              value={choice}
                              checked={when === choice}
                              onChange={() => setWhen(choice)}
                              className="sr-only"
                            />
                            {e(choice === 'now' ? 'whenNow' : 'whenLater')}
                          </label>
                        ))}
                      </div>
                      {when === 'later' ? (
                        <div className="mt-2">
                          <label id="publish-at-label" htmlFor="publish-at" className="mb-1 block text-sm text-ink-2">
                            {e('whenAt')}
                          </label>
                          <DateTimePicker id="publish-at" name="publishAt" labelId="publish-at-label" locale={locale} value={publishAt} onChange={setPublishAt} />
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
                <button ref={trashOpener} type="button" onClick={() => setConfirmTrash(true)} className={TRASH_BUTTON}>
                  {e('button.trash')}
                </button>
              ) : null}
            </Panel>

            <Panel title={e('panel.categories')} required={e('requiredToPublish')}>
              {categoryOptions.length === 0 ? (
                <p className="text-muted">{e('categoriesEmpty')}</p>
              ) : (
                <ul className="grid gap-1">
                  {categoryOptions.map((category) => (
                    <li key={category.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] text-ink sm:min-h-10">
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
                        {category.unlisted ? <span className="text-sm text-muted"> ({e('categoryNotListed')})</span> : null}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <AddCategory locale={locale} create={createCategory} onAdded={addCategory} />
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
      <ConfirmDialog
        open={confirmTrash}
        onClose={() => setConfirmTrash(false)}
        title={e('confirm.trashTitle')}
        text={e('confirm.trashText')}
        confirmLabel={e('confirm.trash')}
        cancelLabel={e('confirm.cancel')}
        tone="danger"
        icon="trash"
        form="trash-form"
        pending={trashing}
        returnFocusRef={trashOpener}
      />
    </>
  );
}
