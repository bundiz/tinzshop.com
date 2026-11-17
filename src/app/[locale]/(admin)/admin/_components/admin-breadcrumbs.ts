/** A crumb of the back office's top row: a message key under `admin.*`, and a link unless it is the current page. */
export type AdminCrumb = { key: 'nav.dashboard' | 'nav.news' | 'nav.users' | 'news.editor.back' | 'news.new' | 'news.title'; href?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The trail `AdminShell` shows beside the TH/EN switch for a back-office path (owner, 2026-11-17): a section page is its
 * menu name alone; the new-article and edit pages start with "ข่าวทั้งหมด", a link to the list. An unknown path has none.
 */
export function adminBreadcrumbs(pathname: string, locale: string): AdminCrumb[] {
  const prefix = `/${locale}/admin`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return [];
  const rest = pathname.slice(prefix.length);
  const allNews: AdminCrumb = { key: 'news.editor.back', href: `${prefix}/news` };
  if (rest === '') return [{ key: 'nav.dashboard' }];
  if (rest === '/news') return [{ key: 'nav.news' }];
  if (rest === '/users') return [{ key: 'nav.users' }];
  if (rest === '/news/new') return [allNews, { key: 'news.new' }];
  const id = /^\/news\/([^/]+)$/.exec(rest)?.[1];
  if (id !== undefined && UUID.test(id)) return [allNews, { key: 'news.title' }];
  return [];
}
