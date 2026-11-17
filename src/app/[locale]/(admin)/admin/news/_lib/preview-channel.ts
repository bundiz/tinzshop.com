import type { ArticlePreviewDraft } from '@/server/services/news/news-admin-service';

/**
 * The link between the news editor and its live preview tab (D-253): a `BroadcastChannel` per preview session, same
 * origin only, nothing stored on the server. The preview posts `ready` when it opens; the editor answers with the draft at
 * once, posts it again 500 ms after the last change, and posts `closed` when it goes away.
 */
export type PreviewMessage = { type: 'ready' } | { type: 'closed' } | { type: 'draft'; draft: ArticlePreviewDraft };

/** How long the editor waits after the last change before it sends the draft. */
export const PREVIEW_DEBOUNCE_MS = 500;

/** How long the preview waits for a first draft before it says no editor is answering. */
export const PREVIEW_SILENCE_MS = 3_000;

/** Where the editor keeps its session in the browser tab, so the preview follows it from a new article to its saved page. */
export const PREVIEW_SESSION_STORAGE_KEY = 'tinz-news-preview-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPreviewSession(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function previewChannelName(session: string): string {
  return `tinz-news-preview:${session}`;
}

/** The preview tab's window name: a second click on "ดูตัวอย่าง" reuses the tab instead of opening another. */
export function previewWindowName(session: string): string {
  return `tinz-preview-${session}`;
}

export function previewPath(locale: string, session: string): string {
  return `/${locale}/admin/news/preview?session=${session}`;
}

/** A message from the other tab, checked by shape only: the draft itself is validated by the server action. */
export function isPreviewMessage(data: unknown): data is PreviewMessage {
  if (typeof data !== 'object' || data === null) return false;
  const type = (data as { type?: unknown }).type;
  return type === 'ready' || type === 'closed' || (type === 'draft' && typeof (data as { draft?: unknown }).draft === 'object');
}

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** The editor's Bangkok-local date-time (`YYYY-MM-DDTHH:mm`) as an ISO instant; null when it is blank or not a date. */
function bangkokLocalToIso(value: string): string | null {
  const match = LOCAL_DATE_TIME.exec(value.trim());
  if (match === null) return null;
  const [, year, month, day, hour, minute] = match.map(Number) as [number, number, number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type DraftText = { title: string; excerpt: string };

export type PreviewDraftInput = {
  articleId: string | null;
  /** The language tab the editor shows. */
  language: 'th' | 'en';
  th: DraftText;
  en: DraftText;
  /** Each body exactly as a save would send it (a locked body is the stored one). */
  thBodyHtml: string;
  enBodyHtml: string;
  slug: string;
  bylineName: string;
  categoryIds: string[];
  status: 'draft' | 'scheduled' | 'published';
  storedPublishedAt: string | null;
  when: 'now' | 'later';
  publishAt: string;
};

/**
 * The draft the preview draws: what a save would send for the language tab on show, Thai when English is on show but has
 * neither a title nor a body. Its date is the chosen time when "later" holds a valid one, else a published (or still
 * scheduled) article's stored date, else null, which the server reads as now.
 */
export function buildPreviewDraft(input: PreviewDraftInput): ArticlePreviewDraft {
  const english = input.language === 'en' && (input.en.title.trim() !== '' || input.enBodyHtml !== '');
  const text = english ? input.en : input.th;
  const scheduled = input.when === 'later' ? bangkokLocalToIso(input.publishAt) : null;
  const keepsStoredDate = input.status === 'published' || (input.status === 'scheduled' && input.when === 'later');
  return {
    articleId: input.articleId,
    contentLanguage: english ? 'en' : 'th',
    slug: input.slug,
    title: text.title,
    excerpt: text.excerpt,
    bodyHtml: english ? input.enBodyHtml : input.thBodyHtml,
    bylineName: input.bylineName,
    categoryIds: input.categoryIds,
    publishedAt: scheduled ?? (keepsStoredDate ? input.storedPublishedAt : null),
  };
}
