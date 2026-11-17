'use server';

import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { routing } from '@/i18n/routing';
import { getNewsAdminCommands } from '@/server/composition-root';
import type { NewsArticleDetail } from '@/server/services/news/news-read-service';
import { requirePermission } from '../../../../(admin)/admin/_lib/require-permission';

/**
 * The live preview's data (D-253): the editor's unsaved draft as the storefront's article page needs it — sanitised body,
 * live product cards, category names, byline and date — for the preview tab to draw with `NewsArticleView`. It returns
 * data, never a rendered element: an element would carry client components the preview route does not load, and React
 * could not find them. Re-checks `news.manage`; the draft is validated with the save's caps (null when it is not valid).
 * Nothing is written, and the draft's text is never logged (D-242).
 */
export async function previewArticleAction(locale: string, draft: unknown): Promise<NewsArticleDetail | null> {
  const pageLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  setRequestLocale(pageLocale);
  const editor = await requirePermission(pageLocale, '/admin/news/preview', 'news.manage');
  return getNewsAdminCommands().preview(editor, draft, pageLocale);
}
