'use server';

import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { createElement, type ReactNode } from 'react';

import { routing } from '@/i18n/routing';
import { getNewsAdminCommands } from '@/server/composition-root';
import NewsArticleView from '../../../../(shop)/news/[slug]/_components/NewsArticleView';
import { readArticlesMenu } from '../../../../(shop)/_components/read-articles-menu';
import { readCurrentCustomer } from '../../../../(shop)/_components/read-current-customer';
import { requirePermission } from '../../../../(admin)/admin/_lib/require-permission';

/**
 * The live preview's render (D-253): the editor's unsaved draft drawn by the storefront's own `NewsArticleView`, returned
 * as a React element for the preview tab to show. Re-checks `news.manage`; the draft is validated with the save's caps
 * (null when it is not valid). Nothing is written, and the draft's text is never logged (D-242).
 */
export async function previewArticleAction(locale: string, draft: unknown): Promise<ReactNode> {
  const pageLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  setRequestLocale(pageLocale);
  const editor = await requirePermission(pageLocale, '/admin/news/preview', 'news.manage');
  const detail = await getNewsAdminCommands().preview(editor, draft, pageLocale);
  if (detail === null) return null;
  const [articlesMenu, customer] = await Promise.all([readArticlesMenu(pageLocale), readCurrentCustomer()]);
  return createElement(NewsArticleView, { article: detail, articlesMenu, customer });
}
