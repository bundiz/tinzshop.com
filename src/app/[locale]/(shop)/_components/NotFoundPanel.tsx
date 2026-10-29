import { useLocale } from 'next-intl';
import Link from 'next/link';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

export type NotFoundPanelProps = {
  title: string;
  text: string;
  backHome: string;
};

/** A storefront not-found screen: said plainly inside the site header and footer, with a way home (07 Loading, empty and error). */
export default function NotFoundPanel({ title, text, backHome }: NotFoundPanelProps) {
  const locale = useLocale();

  return (
    <>
      <SiteHeader path="/" />
      <main className="mx-auto max-w-[1280px] px-4 pt-4 pb-10 md:px-6">
        <section className="rounded-(--radius) bg-bg p-8 text-center">
          <h1 className="text-[22px]">{title}</h1>
          <p className="mt-2 text-text-muted">{text}</p>
          <Link
            href={`/${locale}`}
            className="mt-5 inline-flex min-h-11 items-center rounded-(--radius-sm) bg-primary px-5 font-semibold text-white hover:bg-primary-dark"
          >
            {backHome}
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
