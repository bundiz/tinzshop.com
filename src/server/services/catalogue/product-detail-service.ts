import { isStorefrontVisible, pickProductName, type Locale } from './landing-catalogue-service';

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
};

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
  isPreOrder: boolean;
  releaseDate: Date | null;
  shippingSizeTier: ShippingSizeTier | null;
};

const byPosition = (a: { position: number }, b: { position: number }): number => a.position - b.position;

function cheapest(variants: StorefrontProductVariantRow[]): StorefrontProductVariantRow | undefined {
  return variants.reduce<StorefrontProductVariantRow | undefined>(
    (best, variant) => (best === undefined || variant.priceSatang < best.priceSatang ? variant : best),
    undefined,
  );
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
      originalPriceSatang: variant.originalPriceSatang !== variant.priceSatang ? variant.originalPriceSatang : null,
      stockStatus: variant.stockQuantity > 0 ? 'in_stock' : 'out_of_stock',
    })),
    defaultVariantId: chosen.variantId,
    isPreOrder: row.isPreOrder,
    releaseDate: row.releaseDate,
    shippingSizeTier: row.shippingSizeTier,
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
