import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';

export type BreadcrumbProps = {
  /** The product name, the last crumb. */
  productName: string;
};

/** Home › product name. No category crumb until categories exist (plan 011). */
export default function Breadcrumb({ productName }: BreadcrumbProps) {
  const t = useTranslations('shop.product.breadcrumb');
  const locale = useLocale();

  return (
    <nav aria-label={t('label')} className="py-3 text-[13px] text-text-subtle">
      <ol className="flex flex-wrap items-center gap-1">
        <li className="flex items-center gap-1">
          <Link href={`/${locale}`} className="hover:text-primary">
            {t('home')}
          </Link>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4 flex-none fill-none stroke-current"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </li>
        <li aria-current="page" className="min-w-0 text-text [overflow-wrap:anywhere]">
          {productName}
        </li>
      </ol>
    </nav>
  );
}
