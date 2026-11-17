/** A crumb of the back office's top row: a message key under `admin.*`, and a link unless it is the current page. */
export type AdminCrumb = { key: 'news.editor.back' | 'news.new' | 'news.title'; href?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The trail `AdminShell` shows at the top of a back-office page (owner, 2026-11-17): the new-article and edit pages start
 * with "ข่าวทั้งหมด", a link to the list. A section page (dashboard, news list, users) has none, since its heading already
 * names it; neither has an unknown path.
 */
export function adminBreadcrumbs(pathname: string, locale: string): AdminCrumb[] {
  const prefix = `/${locale}/admin`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return [];
  const rest = pathname.slice(prefix.length);
  const allNews: AdminCrumb = { key: 'news.editor.back', href: `${prefix}/news` };
  if (rest === '/news/new') return [allNews, { key: 'news.new' }];
  const id = /^\/news\/([^/]+)$/.exec(rest)?.[1];
  if (id !== undefined && UUID.test(id)) return [allNews, { key: 'news.title' }];
  return [];
}
