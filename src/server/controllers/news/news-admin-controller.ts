import { z } from 'zod';

import type { ProductPickerHit } from '@/server/services/catalogue/product-search-service';
import { can } from '@/server/services/access/access-service';
import type { PermissionKey } from '@/server/services/access/permission-keys';
import type { SaveArticleInput } from '@/server/services/news/news-admin-service';
import type { Result } from '@/server/services/shared/result';

/** A key under `admin.news.error.*` in the message files. */
export type NewsAdminErrorKey =
  | 'forbidden'
  | 'invalid'
  | 'notFound'
  | 'titleRequired'
  | 'bodyRequired'
  | 'excerptRequired'
  | 'englishIncomplete'
  | 'categories'
  | 'products'
  | 'publishAtInvalid'
  | 'publishAtRequired';

/** What a news form shows after it runs (plan 016, Task 9). `saved` carries what the editor needs to move on. */
export type NewsAdminState =
  | { status: 'idle' }
  | { status: 'saved'; id: string; slug: string; action: 'draft' | 'publish' | 'unpublish' }
  | { status: 'done' }
  | { status: 'error'; errorKey: NewsAdminErrorKey };

export type NewsAdminActor = { id: string; permissions: readonly PermissionKey[] };

export type NewsAdminCommandDeps = {
  save: (request: SaveArticleInput) => Promise<Result<{ id: string; slug: string }>>;
  trash: (id: string, editorId: string) => Promise<Result<{ id: string }>>;
  restore: (id: string, editorId: string) => Promise<Result<{ id: string }>>;
  searchProducts: (query: string) => Promise<ProductPickerHit[]>;
  now: () => Date;
  /** Ids and the action only: never a title, an excerpt or body text (D-242). */
  log: (message: string, fields: Record<string, unknown>) => void;
};

const error = (errorKey: NewsAdminErrorKey): NewsAdminState => ({ status: 'error', errorKey });

const uuid = z.uuid();
const field = z.string().max(200_000);
/** A title is capped so the slug made from it fits the unique index (D-252). */
const title = z.string().max(300);

/** The form's text fields; a missing one reads as empty (`FormData.get` gives null). */
const SaveForm = z.object({
  id: z.uuid().nullable(),
  action: z.enum(['draft', 'publish', 'unpublish']),
  slug: z.string().max(300),
  bylineName: z.string().max(200),
  thTitle: title,
  thExcerpt: field,
  thBodyHtml: field,
  enTitle: title,
  enExcerpt: field,
  enBodyHtml: field,
  publishAt: z.string().max(40),
  when: z.enum(['now', 'later', '']),
  categoryIds: z.array(uuid).max(100),
  productIds: z.array(uuid).max(100),
  tagNames: z.array(z.string().max(100)).max(100),
});

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function readList(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((value): value is string => typeof value === 'string' && value.trim() !== '');
}

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * A Bangkok-local `YYYY-MM-DDTHH:mm` (the browser's date-time input) as the UTC instant; null for blank; `'invalid'` for
 * anything else, a date that does not exist included. Thailand has no daylight saving: always UTC+7.
 */
export function parsePublishAt(value: string): Date | null | 'invalid' {
  const text = value.trim();
  if (text === '') return null;
  const match = LOCAL_DATE_TIME.exec(text);
  if (match === null) return 'invalid';
  const [, year, month, day, hour, minute] = match.map(Number) as [number, number, number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
  const local = new Date(date.getTime() + 7 * 3_600_000);
  const sameDay = local.getUTCFullYear() === year && local.getUTCMonth() === month - 1 && local.getUTCDate() === day;
  return sameDay && local.getUTCHours() === hour && local.getUTCMinutes() === minute ? date : 'invalid';
}

function mapFailure(result: { error: { code: string; details?: unknown } }): NewsAdminErrorKey {
  if (result.error.code === 'news.not_found') return 'notFound';
  const fieldName = (result.error.details as { field?: string } | undefined)?.field;
  switch (fieldName) {
    case 'th.title':
      return 'titleRequired';
    case 'th.bodyHtml':
      return 'bodyRequired';
    case 'th.excerpt':
      return 'excerptRequired';
    case 'en':
      return 'englishIncomplete';
    case 'categoryIds':
      return 'categories';
    case 'productIds':
      return 'products';
    default:
      return 'invalid';
  }
}

/**
 * Creates or updates an article, or changes its state (`news.manage`). Every check the form can fail is answered with a
 * message key; the title and body text are never logged.
 */
export async function saveArticleCommand(
  deps: NewsAdminCommandDeps,
  actor: NewsAdminActor,
  formData: FormData,
): Promise<NewsAdminState> {
  if (!can(actor, 'news.manage')) return error('forbidden');
  const idText = readString(formData, 'id');
  const parsed = SaveForm.safeParse({
    id: idText === '' ? null : idText,
    action: readString(formData, 'action'),
    slug: readString(formData, 'slug'),
    bylineName: readString(formData, 'bylineName'),
    thTitle: readString(formData, 'thTitle'),
    thExcerpt: readString(formData, 'thExcerpt'),
    thBodyHtml: readString(formData, 'thBodyHtml'),
    enTitle: readString(formData, 'enTitle'),
    enExcerpt: readString(formData, 'enExcerpt'),
    enBodyHtml: readString(formData, 'enBodyHtml'),
    publishAt: readString(formData, 'publishAt'),
    when: readString(formData, 'when'),
    categoryIds: readList(formData, 'categoryId'),
    productIds: readList(formData, 'productId'),
    tagNames: readList(formData, 'tag'),
  });
  if (!parsed.success) return error('invalid');
  const form = parsed.data;

  if (form.thTitle.trim() === '') return error('titleRequired');
  if (form.thBodyHtml.trim() === '') return error('bodyRequired');
  const english = [form.enTitle, form.enExcerpt, form.enBodyHtml].map((value) => value.trim());
  const hasEnglish = english.some((value) => value !== '');
  if (hasEnglish && (english[0] === '' || english[2] === '')) return error('englishIncomplete');
  const publishAt = parsePublishAt(form.publishAt);
  if (publishAt === 'invalid') return error('publishAtInvalid');
  // "Publish later" chosen with no date is a mistake, not an immediate publish.
  if (form.action === 'publish' && form.when === 'later' && publishAt === null) return error('publishAtRequired');

  const result = await deps.save({
    id: form.id,
    editorId: actor.id,
    input: {
      slug: form.slug.trim() === '' ? null : form.slug,
      th: { title: form.thTitle, excerpt: form.thExcerpt, bodyHtml: form.thBodyHtml },
      en: hasEnglish ? { title: form.enTitle, excerpt: form.enExcerpt, bodyHtml: form.enBodyHtml } : null,
      categoryIds: form.categoryIds,
      tagNames: form.tagNames,
      productIds: form.productIds,
      bylineName: form.bylineName,
    },
    action: form.action,
    publishAt,
    now: deps.now(),
  });
  if (!result.ok) return error(mapFailure(result));
  deps.log('news.article_saved', { actor: actor.id, article: result.data.id, action: form.action });
  return { status: 'saved', id: result.data.id, slug: result.data.slug, action: form.action };
}

async function moveCommand(
  run: (id: string, editorId: string) => Promise<Result<{ id: string }>>,
  logName: string,
  deps: NewsAdminCommandDeps,
  actor: NewsAdminActor,
  formData: FormData,
): Promise<NewsAdminState> {
  if (!can(actor, 'news.manage')) return error('forbidden');
  const id = uuid.safeParse(readString(formData, 'id'));
  if (!id.success) return error('invalid');
  const result = await run(id.data, actor.id);
  if (!result.ok) return error(mapFailure(result));
  deps.log(logName, { actor: actor.id, article: id.data });
  return { status: 'done' };
}

/** Moves an article to the trash (`news.manage`); nothing is deleted for good (D-131). */
export function trashArticleCommand(deps: NewsAdminCommandDeps, actor: NewsAdminActor, formData: FormData): Promise<NewsAdminState> {
  return moveCommand(deps.trash, 'news.article_trashed', deps, actor, formData);
}

/** Takes an article back out of the trash (`news.manage`). */
export function restoreArticleCommand(deps: NewsAdminCommandDeps, actor: NewsAdminActor, formData: FormData): Promise<NewsAdminState> {
  return moveCommand(deps.restore, 'news.article_restored', deps, actor, formData);
}

/** The editor's product picker: up to ten active products, for `news.manage` only; anyone else gets nothing. */
export async function searchProductsCommand(deps: NewsAdminCommandDeps, actor: NewsAdminActor, query: string): Promise<ProductPickerHit[]> {
  if (!can(actor, 'news.manage')) return [];
  const text = query.trim();
  return text === '' ? [] : deps.searchProducts(text);
}
