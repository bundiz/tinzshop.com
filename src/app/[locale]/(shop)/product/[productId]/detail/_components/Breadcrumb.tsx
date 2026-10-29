import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ProductDetailCategory } from '@/server/services/catalogue/product-detail-service';
import { listingHref } from '../../../listing-url';

export type BreadcrumbProps = {
  /** The product name, the last crumb. */
  productName: string;
  /** The product's platform, linked to its listing; `null` for an uncategorised product. */
  platformCategory: ProductDetailCategory | null;
  /** The product's type, linked to the platform's listing narrowed to it; shown only with a platform. */
  productType: ProductDetailCategory | null;
};

/**
 * หน้าแรก › {platform} › {type} › product name, each category crumb a link to the listing (plan 013 Task 5).
 * An uncategorised product gets หน้าแรก › สินค้าทั้งหมด › product name.
 */
export default function Breadcrumb({ productName, platformCategory, productType }: BreadcrumbProps) {
  const t = useTranslations('shop.product.breadcrumb');
  const locale = useLocale();

  const links: { label: string; href: string }[] = [{ label: t('home'), href: `/${locale}` }];
  if (platformCategory === null) {
    links.push({ label: t('allProducts'), href: listingHref(locale) });
  } else {
    links.push({ label: platformCategory.name, href: listingHref(locale, { category: platformCategory.slug }) });
    if (productType !== null) {
      links.push({
        label: productType.name,
        href: listingHref(locale, { category: platformCategory.slug, types: [productType.slug] }),
      });
    }
  }

  return (
    <nav aria-label={t('label')} className="py-3 text-[13px] text-text-subtle">
      <ol className="flex flex-wrap items-center gap-1">
        {links.map((link) => (
          <li key={link.href} className="flex items-center gap-1">
            <Link href={link.href} className="hover:text-primary">
              {link.label}
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
        ))}
        <li aria-current="page" className="min-w-0 text-text [overflow-wrap:anywhere]">
          {productName}
        </li>
      </ol>
    </nav>
  );
}
