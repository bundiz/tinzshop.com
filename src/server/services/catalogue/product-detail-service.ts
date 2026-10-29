import { isStorefrontVisible, pickProductName, type Locale } from './landing-catalogue-service';
import type { StorefrontCategory } from './storefront-listing-service';

export type ShippingSizeTier = 'small' | 'medium' | 'large';

export type StorefrontProductVariantRow = {
  variantId: string;
  position: number;
  priceSatang: bigint;
  originalPriceSatang: bigint;
  stockQuantity: number;
  isActive: boolean;
  optionValueIds: string[];
};

/** One mirrored product as the product page read returns it; plain data, no Prisma types. */
export type StorefrontProductRow = {
  productId: string;
  isActive: boolean;
  externalStatus: string;
  names: { th?: string; en?: string };
  descriptions: { th?: string; en?: string };
  brandName: string | null;
  shippingSizeTier: ShippingSizeTier | null;
  /** A Shopee kit item (a ชุดโปรโมชั่น set): `channel_item.is_kit`. */
  isKit: boolean;
  isPreOrder: boolean;
  releaseDate: Date | null;
  images: { url: string; position: number }[];
  optionTypes: {
    id: string;
    name: string;
    position: number;
    values: { id: string; value: string; position: number }[];
  }[];
  variants: StorefrontProductVariantRow[];
  /** `product.primary_category_id`, the breadcrumb category (spec 5.2). */
  primaryCategoryId: string | null;
  /** The product's `product_category` rows, plus the parent of each, with their names. */
  categories: StorefrontCategory[];
};

/** A category as the breadcrumb links to it: its slug for the listing URL and its name in the locale. */
export type ProductDetailCategory = { slug: string; name: string };

export type ProductDetailVariant = {
  variantId: string;
  optionValueIds: string[];
  priceSatang: bigint;
  /** The pre-discount price, or `null` when it equals the price. */
  originalPriceSatang: bigint | null;
  stockStatus: 'in_stock' | 'out_of_stock';
};

export type ProductDetail = {
  productId: string;
  name: string;
  description: string;
  brandName: string | null;
  imageUrls: string[];
  optionTypes: { id: string; name: string; values: { id: string; value: string }[] }[];
  /** Active variants only, in Shopee's order. */
  variants: ProductDetailVariant[];
  /** The cheapest in-stock variant, else the cheapest one. */
  defaultVariantId: string;
  isKit: boolean;
  isPreOrder: boolean;
  releaseDate: Date | null;
  shippingSizeTier: ShippingSizeTier | null;
  /** The breadcrumb's platform (a top-level category), or `null` for an uncategorised product. */
  platformCategory: ProductDetailCategory | null;
  /** The breadcrumb's product type (a child of `platformCategory`), or `null`. */
  productType: ProductDetailCategory | null;
};

const byPosition = (a: { position: number }, b: { position: number }): number => a.position - b.position;

function cheapest(variants: StorefrontProductVariantRow[]): StorefrontProductVariantRow | undefined {
  return variants.reduce<StorefrontProductVariantRow | undefined>(
    (best, variant) => (best === undefined || variant.priceSatang < best.priceSatang ? variant : best),
    undefined,
  );
}

/**
 * The breadcrumb's platform and type (plan 013 Task 5). The type is the primary category when that is a
 * product type, else the product's first type by position; the platform is the type's parent, or, with no
 * type, the primary category or the first platform. A type whose platform is not known is left out.
 */
function breadcrumbCategories(
  row: Pick<StorefrontProductRow, 'primaryCategoryId' | 'categories'>,
  locale: Locale,
): Pick<ProductDetail, 'platformCategory' | 'productType'> {
  const byId = new Map(row.categories.map((category) => [category.id, category]));
  const primary = row.primaryCategoryId === null ? undefined : byId.get(row.primaryCategoryId);
  const sorted = [...row.categories].sort((a, b) => byPosition(a, b) || a.slug.localeCompare(b.slug));
  const parentOf = (category: StorefrontCategory) =>
    category.parentId === null ? undefined : byId.get(category.parentId);
  const isPlatform = (category: StorefrontCategory | undefined) =>
    category !== undefined && category.parentId === null;

  const type = [primary, ...sorted].find((category) => category !== undefined && isPlatform(parentOf(category)));
  const platform = type === undefined ? [primary, ...sorted].find(isPlatform) : parentOf(type);
  const named = (category: StorefrontCategory | undefined): ProductDetailCategory | null =>
    category === undefined ? null : { slug: category.slug, name: pickProductName(category, locale) };
  return { platformCategory: named(platform), productType: named(type) };
}

export function toProductDetail(row: StorefrontProductRow, locale: Locale): ProductDetail | null {
  if (!isStorefrontVisible(row)) return null;
  const active = row.variants.filter((variant) => variant.isActive).sort(byPosition);
  const chosen = cheapest(active.filter((variant) => variant.stockQuantity > 0)) ?? cheapest(active);
  if (chosen === undefined) return null;

  return {
    productId: row.productId,
    name: pickProductName(row, locale),
    description: pickProductName({ names: row.descriptions }, locale),
    brandName: row.brandName,
    imageUrls: [...row.images].sort(byPosition).map((image) => image.url),
    optionTypes: [...row.optionTypes].sort(byPosition).map((type) => ({
      id: type.id,
      name: type.name,
      values: [...type.values].sort(byPosition).map((value) => ({ id: value.id, value: value.value })),
    })),
    variants: active.map((variant) => ({
      variantId: variant.variantId,
      optionValueIds: variant.optionValueIds,
      priceSatang: variant.priceSatang,
      originalPriceSatang: variant.originalPriceSatang > variant.priceSatang ? variant.originalPriceSatang : null,
      stockStatus: variant.stockQuantity > 0 ? 'in_stock' : 'out_of_stock',
    })),
    defaultVariantId: chosen.variantId,
    isKit: row.isKit,
    isPreOrder: row.isPreOrder,
    releaseDate: row.releaseDate,
    shippingSizeTier: row.shippingSizeTier,
    ...breadcrumbCategories(row, locale),
  };
}

/** The product page read: `null` for an unknown, malformed or hidden product (spec §5.3). */
export async function getProductDetail(
  deps: { findStorefrontProduct: (productId: string) => Promise<StorefrontProductRow | null> },
  productId: string,
  locale: Locale,
): Promise<ProductDetail | null> {
  const row = await deps.findStorefrontProduct(productId);
  return row === null ? null : toProductDetail(row, locale);
}
