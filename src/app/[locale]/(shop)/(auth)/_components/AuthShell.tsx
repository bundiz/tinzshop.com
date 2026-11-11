import type { ReactNode } from 'react';
import type { ArticlesMenuEntry } from '../../_components/articles-menu';
import SiteFooter from '../../_components/SiteFooter';
import SiteHeader from '../../_components/SiteHeader';

/**
 * The site header and footer around an auth card. A signed-in customer never sees these pages (sign-in and
 * register send them home), and verify and reset are for a visitor who is not signed in, so the header is the
 * signed-out one.
 */
export default function AuthShell({ path, articlesMenu, children }: { path: string; articlesMenu: ArticlesMenuEntry[]; children: ReactNode }) {
  return (
    <>
      <SiteHeader path={path} articlesMenu={articlesMenu} />
      {children}
      <SiteFooter />
    </>
  );
}
