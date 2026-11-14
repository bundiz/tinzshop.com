import { useLocale } from 'next-intl';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-class';
import type { ArticlesMenuEntry } from './articles-menu';
import SiteFooter from './SiteFooter';
import SiteHeader, { type HeaderCustomer } from './SiteHeader';

export type NotFoundPanelProps = {
  title: string;
  text: string;
  backHome: string;
  /** The header's "บทความ" menu (`readRequestArticlesMenu`). */
  articlesMenu: ArticlesMenuEntry[];
  /** The signed-in customer for the header (`readCurrentCustomer`), or null. */
  customer?: HeaderCustomer | null;
};

/** A storefront not-found screen: said plainly inside the site header and footer, with a way home (07 Loading, empty and error). */
export default function NotFoundPanel({ title, text, backHome, articlesMenu, customer = null }: NotFoundPanelProps) {
  const locale = useLocale();

  return (
    <>
      <SiteHeader path="/" articlesMenu={articlesMenu} customer={customer} />
      <main id="main" className="wrap pt-4 pb-10">
        <section className="rounded-lg border border-line bg-surface p-[18px] text-center sm:p-8">
          <h1 className="text-[22px]">{title}</h1>
          <p className="mt-2 text-muted">{text}</p>
          <Link href={`/${locale}`} className={`${buttonClass({ variant: 'brand' })} mt-5`}>
            {backHome}
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
