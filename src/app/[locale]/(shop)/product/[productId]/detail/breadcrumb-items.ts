import type { BreadcrumbItem } from '@/components/ui/Breadcrumbs';
import type { ProductDetailCategory } from '@/server/services/catalogue/product-detail-service';
import { listingHref } from '../../listing-url';

/**
 * The product page's trail for `Breadcrumbs`: หน้าแรก › {platform} › {type} › product name, each category crumb a
 * link to the listing (plan 013 Task 5, D-151). An uncategorised product gets หน้าแรก › สินค้าทั้งหมด › product name.
 */
export function breadcrumbItems(
  locale: string,
  labels: { home: string; allProducts: string },
  product: {
    productName: string;
    /** The product's platform, linked to its listing; `null` for an uncategorised product. */
    platformCategory: ProductDetailCategory | null;
    /** The product's type, linked to the platform's listing narrowed to it; shown only with a platform. */
    productType: ProductDetailCategory | null;
  },
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: labels.home, href: `/${locale}` }];
  if (product.platformCategory === null) {
    items.push({ label: labels.allProducts, href: listingHref(locale) });
  } else {
    items.push({
      label: product.platformCategory.name,
      href: listingHref(locale, { category: product.platformCategory.slug }),
    });
    if (product.productType !== null) {
      items.push({
        label: product.productType.name,
        href: listingHref(locale, { category: product.platformCategory.slug, types: [product.productType.slug] }),
      });
    }
  }
  items.push({ label: product.productName });
  return items;
}
