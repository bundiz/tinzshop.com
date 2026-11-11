import type { ReactNode } from 'react';
import type { ArticlesMenuEntry } from '../../_components/articles-menu';
import SiteFooter from '../../_components/SiteFooter';
import SiteHeader from '../../_components/SiteHeader';

/**
 * The site header and footer around an auth card, with the real customer in the header (sign-in and register send
 * a signed-in customer home, but verify and reset do not, so they show the name).
 */
export default function AuthShell({
  path,
  articlesMenu,
  customer = null,
  children,
}: {
  /** The page's path with its query and without the locale, so the language switch keeps `returnTo`. */
  path: string;
  articlesMenu: ArticlesMenuEntry[];
  customer?: { firstName: string } | null;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader path={path} articlesMenu={articlesMenu} customer={customer} />
      {children}
      <SiteFooter />
    </>
  );
}
