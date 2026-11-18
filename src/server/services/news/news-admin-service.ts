import { decodeHtmlEntities, isNewsMediaKey, NEWS_IMAGE_ALT_MAX_LENGTH } from '@/server/adapters/wordpress/sanitize';
import { pickProductName, type LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import { mediaPublicUrl, resolveFeaturedImageUrl, resolveMediaKeys } from '@/server/services/media/media-url';
import type { NewsArticleDetail, NewsCategoryRow } from '@/server/services/news/news-read-service';
import type { NewsLocale } from '@/server/services/news/news-snapshot';
import type { DomainError, Result } from '@/server/services/shared/result';

/** What the list shows. "Scheduled" is derived, never stored: published with a future `published_at` (D-130). */
export type NewsAdminStatus = 'draft' | 'scheduled' | 'published';

export type ArticleTranslationInput = { title: string; excerpt: string; bodyHtml: string };

/**
 * What a save does to the cover (plan 017, D-278): keep it, remove it, or set an uploaded one by its media key. Posted as
 * the form field `featuredImage`: `unchanged`, `none` or `media:{key}`.
 */
export type FeaturedImageChoice = { kind: 'unchanged' } | { kind: 'none' } | { kind: 'media'; key: string };

export type ArticleInput = {
  /** Null on first save: made from the Thai title; on an edit: the stored slug is kept. */
  slug: string | null;
  th: ArticleTranslationInput;
  /** All or nothing: title and body both, or null. */
  en: ArticleTranslationInput | null;
  categoryIds: string[];
  tagNames: string[];
  productIds: string[];
  /** Empty means the editor's first name. */
  bylineName: string;
  /** Allowed on an imported article too (D-278): the import skips a staff-edited one (D-236). */
  featuredImage: FeaturedImageChoice;
};

export type SaveAction = 'draft' | 'publish' | 'unpublish';

/** One stored article as the editor needs it. `status` is the stored one (`draft` or `published`). */
export type AdminArticleRecord = {
  id: string;
  slug: string;
  status: 'draft' | 'published';
  publishedAt: Date | null;
  bylineName: string | null;
  /** The imported cover's stored URL from the repository; from `getAdminArticle`, the cover's URL to show (D-277). */
  featuredImageUrl: string | null;
  /** An uploaded cover's media key (plan 017); at most one of this and the stored URL is set. */
  featuredImageKey: string | null;
  /** The row has a `source_id`: it came from the old site. */
  isImported: boolean;
  deletedAt: Date | null;
  updatedAt: Date;
  /** First name of `updated_by_staff_id`. */
  lastEditorName: string | null;
  th: ArticleTranslationInput | null;
  en: ArticleTranslationInput | null;
  categoryIds: string[];
  tagNames: string[];
  productIds: string[];
};

/** A list row as the repository returns it: no bodies. */
export type AdminArticleListRecord = {
  id: string;
  slug: string;
  status: 'draft' | 'published';
  publishedAt: Date | null;
  titles: { th?: string; en?: string };
  categoryIds: string[];
  bylineName: string | null;
  lastEditorName: string | null;
  updatedAt: Date;
  deletedAt: Date | null;
  isImported: boolean;
};

export type AdminArticleRow = Omit<AdminArticleListRecord, 'status'> & { status: NewsAdminStatus };

export type AdminArticleFilter = {
  query: string;
  status: NewsAdminStatus | 'trash' | null;
  categoryId: string | null;
  now: Date;
  skip: number;
  take: number;
};

/** What the repository saves in one transaction. Everything is validated, normalised and sanitised. */
export type ArticleWrite = {
  id: string | null;
  editorId: string;
  /** Normalised and not yet made unique (the repository does that inside the transaction); null keeps the stored one. */
  slug: string | null;
  status: 'draft' | 'published';
  publishedAt: Date | null;
  bylineName: string;
  th: ArticleTranslationInput;
  en: ArticleTranslationInput | null;
  categoryIds: string[];
  /** Normalised display names, unique case-insensitively. */
  tagNames: string[];
  productIds: string[];
  /** A `media` key here has passed `isNewsMediaKey`. */
  featuredImage: FeaturedImageChoice;
};

/** A news category's names as staff typed them; English is optional. */
export type NewsCategoryNames = { th: string; en?: string };

/** One news category as the editor's list needs it after a create (D-254). */
export type NewsCategoryOption = { id: string; slug: string; isListed: boolean; names: NewsCategoryNames };

/** What the repository writes for a staff-made category: names trimmed, the slug normalised but not yet unique. */
export type NewsCategoryWrite = {
  slug: string;
  th: string;
  en: string | null;
  /** The Thai name lower-cased: an existing category whose Thai name has this key is a duplicate. */
  nameKey: string;
};

/** A create's outcome: the new row, or the category that already has the Thai name (nothing written). */
export type NewsCategoryCreateOutcome = { status: 'created' | 'duplicate'; category: NewsCategoryOption };

export type NewsAdminDeps = {
  news: {
    listAdminArticles: (filter: AdminArticleFilter) => Promise<{ total: number; rows: AdminArticleListRecord[] }>;
    findAdminArticle: (id: string) => Promise<AdminArticleRecord | null>;
    findExistingCategoryIds: (ids: readonly string[]) => Promise<string[]>;
    /** Of these ids, the categories with `is_listed = true`. */
    findListedCategoryIds: (ids: readonly string[]) => Promise<string[]>;
    findExistingProductIds: (ids: readonly string[]) => Promise<string[]>;
    findEditorFirstName: (editorId: string) => Promise<string | null>;
    /** Null when `id` names no article. */
    saveArticle: (write: ArticleWrite) => Promise<{ id: string; slug: string } | null>;
    /** False when `id` names no article. */
    setArticleDeleted: (id: string, editorId: string, deletedAt: Date | null) => Promise<boolean>;
    /** Checks the Thai name and writes the row under one lock, so two creates at once never clash (D-254). */
    createNewsCategory: (write: NewsCategoryWrite) => Promise<NewsCategoryCreateOutcome>;
  };
  /** Wraps the body sanitiser (`sanitizeArticleHtml(html).html`); every body written goes through it. */
  sanitize: (html: string) => string;
  now: () => Date;
  /** `MEDIA_PUBLIC_BASE_URL`, or null when media storage is not configured (D-277). */
  mediaBaseUrl: string | null;
};

/** The form value of `featuredImage` as a choice; an empty value is `unchanged`; null for anything else. */
export function parseFeaturedImage(value: string): FeaturedImageChoice | null {
  if (value === '' || value === 'unchanged') return { kind: 'unchanged' };
  if (value === 'none') return { kind: 'none' };
  if (value.startsWith('media:') && isNewsMediaKey(value.slice('media:'.length))) return { kind: 'media', key: value.slice('media:'.length) };
  return null;
}

export const ADMIN_PAGE_SIZE = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: string): boolean => UUID.test(value);

function failure(code: string, message: string, details?: unknown): { ok: false; error: DomainError } {
  return {
    ok: false,
    error: { code, message, messageKey: `admin.news.errors.${code.replace('news.', '')}`, ...(details === undefined ? {} : { details }) },
  };
}

const notFound = () => failure('news.not_found', 'No such article');
const invalid = (field: string, message: string) => failure('news.invalid', message, { field });

/** A slug is cut at this many characters (code points), so it stays far under the index limit (D-252). */
const MAX_SLUG_LENGTH = 300;

/**
 * A slug as imported ones look: decoded, lower-cased, whitespace and anything that cannot sit in a URL
 * path segment turned into one hyphen, Thai letters kept. Never empty.
 */
export function normaliseSlug(text: string): string {
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // Not percent-encoded text (a title with a bare "%"): used as it came.
  }
  const slug = [
    ...decoded
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, ''),
  ]
    .slice(0, MAX_SLUG_LENGTH)
    .join('')
    .replace(/-$/, '');
  return slug === '' ? 'news' : slug;
}

/**
 * Tags as stored: every run of whitespace (tabs, newlines, no-break spaces too) becomes one space and the
 * ends are trimmed, so `name_key = lower(btrim(name))` always holds; duplicates ignoring case are dropped,
 * the first spelling kept; empty ones are dropped.
 */
export function normaliseTagNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.replace(/\s+/g, ' ').trim();
    const key = name.toLowerCase();
    if (name === '' || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

/** Whether a sanitised body says anything: some text, or an image, an embed or a product card. */
function hasContent(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '') !== '' || /<(img|iframe|tinz-product)\b/i.test(html);
}

/**
 * Whether every uploaded image in a sanitised body has alt text of 1 to 300 characters (plan 017 call 8): a picture
 * staff upload is described for people who cannot see it. An imported `<img src>` without alt is left as it is.
 */
function keyedImagesHaveAlt(html: string): boolean {
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/\sdata-media-key="/.test(tag)) continue;
    const alt = decodeHtmlEntities(/\salt="([^"]*)"/.exec(tag)?.[1] ?? '').trim();
    if (alt === '' || [...alt].length > NEWS_IMAGE_ALT_MAX_LENGTH) return false;
  }
  return true;
}

function deriveStatus(row: { status: 'draft' | 'published'; publishedAt: Date | null }, now: Date): NewsAdminStatus {
  if (row.status === 'draft') return 'draft';
  return row.publishedAt !== null && row.publishedAt.getTime() > now.getTime() ? 'scheduled' : 'published';
}

/** One page (20) of articles, newest `updated_at` first; `trash` lists deleted ones, every other filter excludes them. */
export async function listAdminArticles(
  deps: NewsAdminDeps,
  input: { query: string; status: NewsAdminStatus | 'trash' | null; categoryId: string | null; page: number },
): Promise<{ total: number; rows: AdminArticleRow[] }> {
  const now = deps.now();
  const page = Number.isInteger(input.page) && input.page >= 1 ? input.page : 1;
  // A category id that is not a uuid matches nothing; it must not reach the database.
  const categoryId = input.categoryId !== null && !isUuid(input.categoryId) ? null : input.categoryId;
  if (input.categoryId !== null && categoryId === null) return { total: 0, rows: [] };
  const { total, rows } = await deps.news.listAdminArticles({
    query: input.query.trim(),
    status: input.status,
    categoryId,
    now,
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
  });
  return { total, rows: rows.map((row) => ({ ...row, status: deriveStatus(row, now) })) };
}

/** One article for the editor, trashed ones included; null for a missing one or an id that is not a uuid. */
export async function getAdminArticle(
  deps: NewsAdminDeps,
  id: string,
): Promise<(AdminArticleRecord & { derivedStatus: NewsAdminStatus }) | null> {
  if (!isUuid(id)) return null;
  const row = await deps.news.findAdminArticle(id);
  if (row === null) return null;
  return { ...row, featuredImageUrl: resolveFeaturedImageUrl(row, deps.mediaBaseUrl), derivedStatus: deriveStatus(row, deps.now()) };
}

export type SaveArticleInput = {
  id: string | null;
  editorId: string;
  input: ArticleInput;
  action: SaveAction;
  /** Only read by `publish`: a future time schedules; null or a past time publishes now. */
  publishAt: Date | null;
  now: Date;
};

/**
 * Creates or updates an article in one save. The Thai title and body (non-empty after sanitising) are
 * required on every save; publishing also needs the Thai excerpt and a category (R9, D-248). English is a set;
 * category and product ids must exist; every body is sanitised; the status follows the action (R8, D-247). A trashed
 * article is not found (restore it first).
 */
export async function saveArticle(deps: NewsAdminDeps, request: SaveArticleInput): Promise<Result<{ id: string; slug: string }>> {
  const { id, editorId, input, action, publishAt, now } = request;

  let existing: AdminArticleRecord | null = null;
  if (id !== null) {
    if (!isUuid(id)) return notFound();
    existing = await deps.news.findAdminArticle(id);
    if (existing === null || existing.deletedAt !== null) return notFound();
  }

  const thTitle = input.th.title.trim();
  if (thTitle === '') return invalid('th.title', 'The Thai title is required');
  const thBody = deps.sanitize(input.th.bodyHtml);
  if (!hasContent(thBody)) return invalid('th.bodyHtml', 'The Thai body is required');
  if (!keyedImagesHaveAlt(thBody)) return invalid('body', 'An uploaded image needs alt text of up to 300 characters');
  const thExcerpt = input.th.excerpt.trim();
  if (action === 'publish' && thExcerpt === '') return invalid('th.excerpt', 'The Thai excerpt is required to publish');
  if (input.featuredImage.kind === 'media' && !isNewsMediaKey(input.featuredImage.key)) {
    return invalid('featuredImage', 'The cover is not a media key');
  }

  let en: ArticleTranslationInput | null = null;
  const enTitle = input.en?.title.trim() ?? '';
  const enBodyRaw = input.en?.bodyHtml.trim() ?? '';
  if (input.en !== null && (enTitle !== '' || enBodyRaw !== '' || input.en.excerpt.trim() !== '')) {
    const enBody = deps.sanitize(input.en.bodyHtml);
    if (enTitle === '' || !hasContent(enBody)) return invalid('en', 'English needs a title and a body, or neither');
    if (!keyedImagesHaveAlt(enBody)) return invalid('body', 'An uploaded image needs alt text of up to 300 characters');
    en = { title: enTitle, excerpt: input.en.excerpt.trim(), bodyHtml: enBody };
  }

  const categoryIds = [...new Set(input.categoryIds)];
  const productIds = [...new Set(input.productIds)];
  if (!categoryIds.every(isUuid)) return invalid('categoryIds', 'A category id is not valid');
  if (!productIds.every(isUuid)) return invalid('productIds', 'A product id is not valid');
  if (categoryIds.length > 0 && (await deps.news.findExistingCategoryIds(categoryIds)).length !== categoryIds.length) {
    return invalid('categoryIds', 'A category does not exist');
  }
  if (action === 'publish') {
    if (categoryIds.length === 0) return invalid('categoryIds', 'Publishing needs at least one category');
    // A category already linked may stay (an imported article's unlisted one); a newly linked one must be listed.
    const linked = new Set(existing?.categoryIds ?? []);
    const added = categoryIds.filter((categoryId) => !linked.has(categoryId));
    if (added.length > 0 && (await deps.news.findListedCategoryIds(added)).length !== added.length) {
      return invalid('categoryIds', 'A new category must be listed');
    }
  }
  if (productIds.length > 0 && (await deps.news.findExistingProductIds(productIds)).length !== productIds.length) {
    return invalid('productIds', 'A product does not exist');
  }

  let status: 'draft' | 'published';
  let publishedAt: Date | null;
  if (action === 'publish') {
    status = 'published';
    const storedAt = existing?.status === 'published' ? existing.publishedAt : null;
    const isLive = storedAt !== null && storedAt <= now;
    if (publishAt !== null && publishAt.getTime() > now.getTime()) publishedAt = publishAt;
    // R8: saving an article that is already live is an update and keeps its date; a draft or a
    // scheduled article goes live now.
    else if (isLive) publishedAt = storedAt;
    else publishedAt = now;
  } else {
    // draft and unpublish both leave `published_at` as it was.
    status = 'draft';
    publishedAt = existing?.publishedAt ?? null;
  }

  const bylineName = input.bylineName.trim() !== '' ? input.bylineName.trim() : ((await deps.news.findEditorFirstName(editorId)) ?? '');
  const slugText = input.slug !== null && input.slug.trim() !== '' ? input.slug : existing === null ? thTitle : null;

  const saved = await deps.news.saveArticle({
    id,
    editorId,
    slug: slugText === null ? null : normaliseSlug(slugText),
    status,
    publishedAt,
    bylineName,
    th: { title: thTitle, excerpt: thExcerpt, bodyHtml: thBody },
    en,
    categoryIds,
    tagNames: normaliseTagNames(input.tagNames),
    productIds,
    featuredImage: input.featuredImage,
  });
  return saved === null ? notFound() : { ok: true, data: saved };
}

/** Moves an article to the trash (`deleted_at`, D-131); nothing is deleted for good. */
export async function trashArticle(deps: NewsAdminDeps, id: string, editorId: string): Promise<Result<{ id: string }>> {
  if (!isUuid(id)) return notFound();
  return (await deps.news.setArticleDeleted(id, editorId, deps.now())) ? { ok: true, data: { id } } : notFound();
}

/** Clears `deleted_at`: the article returns as it was (draft, or published if its `published_at` is reached). */
export async function restoreArticle(deps: NewsAdminDeps, id: string, editorId: string): Promise<Result<{ id: string }>> {
  if (!isUuid(id)) return notFound();
  return (await deps.news.setArticleDeleted(id, editorId, null)) ? { ok: true, data: { id } } : notFound();
}

/** A category name is cut at this many characters (code points), Thai and English alike (D-254). */
export const MAX_CATEGORY_NAME_LENGTH = 100;

/** Whitespace as tags have it: every run becomes one space, the ends trimmed. */
function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Creates a news category from the editor (D-254): listed at once, top level, last in order, with no `source_id`, so the
 * import never matches it. The Thai name is required, both names are at most 100 characters, and a category (listed or
 * not) whose Thai name matches ignoring case and spacing is refused as `news.category_exists`, with that category in
 * `details`. The slug comes from the English name, else the Thai one; the repository makes it unique.
 */
export async function createNewsCategory(
  deps: Pick<NewsAdminDeps, 'news'>,
  input: { thName: string; enName: string },
): Promise<Result<NewsCategoryOption>> {
  const th = collapseSpaces(input.thName);
  const en = collapseSpaces(input.enName);
  if (th === '') return failure('news.invalid', 'The Thai name is required', { field: 'thName', reason: 'required' });
  if ([...th].length > MAX_CATEGORY_NAME_LENGTH) {
    return failure('news.invalid', 'The Thai name is too long', { field: 'thName', reason: 'too_long' });
  }
  if ([...en].length > MAX_CATEGORY_NAME_LENGTH) {
    return failure('news.invalid', 'The English name is too long', { field: 'enName', reason: 'too_long' });
  }
  const outcome = await deps.news.createNewsCategory({
    slug: normaliseSlug(en !== '' ? en : th),
    th,
    en: en === '' ? null : en,
    nameKey: th.toLowerCase(),
  });
  if (outcome.status === 'duplicate') {
    return failure('news.category_exists', 'A category with this Thai name exists', { category: outcome.category });
  }
  return { ok: true, data: outcome.category };
}

/** What the editor sends for the live preview (D-253): one language's text as typed, never saved. */
export type ArticlePreviewDraft = {
  /** The article being edited, or null for a new one: only its stored featured image is read. */
  articleId: string | null;
  /** The language of `title`, `excerpt` and `bodyHtml`. */
  contentLanguage: NewsLocale;
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  bylineName: string;
  categoryIds: string[];
  /** An ISO instant (a scheduled time, or a live article's date); null means now. */
  publishedAt: string | null;
  /** The cover as the editor holds it, unsaved: the save's `featuredImage` value (plan 017). */
  featuredImage: string;
};

export type ArticlePreviewDeps = Pick<NewsAdminDeps, 'sanitize' | 'now' | 'mediaBaseUrl'> & {
  news: Pick<NewsAdminDeps['news'], 'findAdminArticle'> & { listNewsCategories: () => Promise<NewsCategoryRow[]> };
  /** The live data of the products the body has cards for (`articleProductCards`, D-245). */
  productCards: (bodyHtml: string, locale: NewsLocale) => Promise<LandingProductCard[]>;
};

/**
 * The article page's data for an unsaved draft (D-253), so the storefront's `NewsArticleView` can draw it: the body through
 * the same sanitiser as a save, the chosen categories that exist (in `position` order, named in `locale`), the byline or
 * else the editor's first name, the draft's date or else now, and no related articles. Nothing is written.
 */
export async function buildArticlePreview(
  deps: ArticlePreviewDeps,
  input: { draft: ArticlePreviewDraft; locale: NewsLocale; editorFirstName: string },
): Promise<NewsArticleDetail> {
  const { draft, locale } = input;
  const sanitized = deps.sanitize(draft.bodyHtml);
  const chosen = new Set(draft.categoryIds);
  const [categories, article, productCards] = await Promise.all([
    deps.news.listNewsCategories(),
    draft.articleId !== null && isUuid(draft.articleId) ? deps.news.findAdminArticle(draft.articleId) : Promise.resolve(null),
    deps.productCards(sanitized, draft.contentLanguage),
  ]);
  // Uploaded images are drawn from their keys, as on the article page (D-277).
  const bodyHtml = resolveMediaKeys(sanitized, deps.mediaBaseUrl);
  const publishedAt = draft.publishedAt === null ? null : new Date(draft.publishedAt);
  const title = draft.title.trim();
  // The cover the editor holds: a new upload or a removal shows before the save; otherwise the stored one.
  const cover = parseFeaturedImage(draft.featuredImage) ?? { kind: 'unchanged' };
  const featuredImageUrl =
    cover.kind === 'none'
      ? null
      : cover.kind === 'media'
        ? deps.mediaBaseUrl === null
          ? null
          : mediaPublicUrl(deps.mediaBaseUrl, cover.key)
        : article === null
          ? null
          : resolveFeaturedImageUrl(article, deps.mediaBaseUrl);
  return {
    slug: normaliseSlug(draft.slug.trim() !== '' ? draft.slug : title),
    title,
    excerpt: draft.excerpt.trim(),
    bylineName: draft.bylineName.trim() !== '' ? draft.bylineName.trim() : input.editorFirstName,
    publishedAt: publishedAt !== null && !Number.isNaN(publishedAt.getTime()) ? publishedAt : deps.now(),
    featuredImageUrl,
    bodyHtml,
    categories: [...categories]
      .sort((a, b) => a.position - b.position)
      .filter((category) => chosen.has(category.id))
      .map((category) => ({ slug: category.slug, name: pickProductName({ names: category.names }, locale) })),
    related: [],
    productCards,
  };
}
