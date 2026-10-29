import { hasLocale } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { cache } from 'react';
import { routing } from '@/i18n/routing';
import { getListedNewsCategoriesReader } from '@/server/composition-root';
import type { ListedNewsCategory } from '@/server/services/news/news-read-service';
import { buildArticlesMenu, type ArticlesMenuEntry } from './articles-menu';

/**
 * The header's category read, which must never break a page (the header is on every shop page): on failure
 * the menu keeps only its items that need no category, and only the error's name is logged, never its
 * message, which can carry connection details (as `readLatestNewsOrNone`).
 */
export async function readListedCategoriesOrNone(
  read: () => Promise<ListedNewsCategory[]>,
  logError: (message: string) => void = (message) => console.error(message),
): Promise<ListedNewsCategory[]> {
  try {
    return await read();
  } catch (error) {
    logError(`articles menu read failed: ${error instanceof Error ? error.name : 'unknown'}`);
    return [];
  }
}

/** The "บทความ" menu for the header (D-140), read once per request however many times it is asked for. */
export const readArticlesMenu = cache(
  async (locale: (typeof routing.locales)[number]): Promise<ArticlesMenuEntry[]> =>
    buildArticlesMenu(await readListedCategoriesOrNone(() => getListedNewsCategoriesReader()(locale)), locale),
);

/** The menu for a screen that has no `params`, such as a not-found page: in the request's locale. */
export async function readRequestArticlesMenu(): Promise<ArticlesMenuEntry[]> {
  const locale = await getLocale();
  return readArticlesMenu(hasLocale(routing.locales, locale) ? locale : routing.defaultLocale);
}
