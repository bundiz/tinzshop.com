import { getPrisma } from '@/server/repositories/shared/prisma';
import type { StorefrontCandidate } from '@/server/services/catalogue/landing-catalogue-service';
import type { StorefrontProductRow } from '@/server/services/catalogue/product-detail-service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every active product whose Shopee item is NORMAL; the service applies the full visibility rule again. */
export async function listStorefrontCandidates(): Promise<StorefrontCandidate[]> {
  const rows = await getPrisma().product.findMany({
    where: { isActive: true, channelItem: { is: { externalStatus: 'NORMAL' } } },
    include: {
      translations: true,
      images: { where: { position: 0 }, take: 1 },
      channelItem: true,
      variants: true,
    },
  });
  return rows.map((row) => ({
    productId: row.id,
    isActive: row.isActive,
    externalStatus: row.channelItem?.externalStatus ?? '',
    names: Object.fromEntries(row.translations.map((t) => [t.locale, t.name])),
    imageUrl: row.images[0]?.url ?? null,
    isKit: row.channelItem?.isKit ?? false,
    salesCount: row.channelItem?.salesCount ?? null,
    isPreOrder: row.isPreOrder,
    releaseDate: row.releaseDate,
    variants: row.variants.map((v) => ({
      priceSatang: v.priceSatang,
      originalPriceSatang: v.originalPriceSatang,
      stockQuantity: v.stockQuantity,
      isActive: v.isActive,
    })),
  }));
}

/**
 * One product with everything the product page shows, or `null` when the id is unknown.
 * A malformed id is `null` without a query: Postgres would reject it as a uuid.
 * The visibility rule is the service's to apply; this returns hidden products too.
 */
export async function findStorefrontProduct(productId: string): Promise<StorefrontProductRow | null> {
  if (!UUID.test(productId)) return null;
  const row = await getPrisma().product.findUnique({
    where: { id: productId },
    include: {
      translations: true,
      images: { orderBy: { position: 'asc' } },
      optionTypes: { orderBy: { position: 'asc' }, include: { values: { orderBy: { position: 'asc' } } } },
      variants: { orderBy: { position: 'asc' }, include: { optionValues: true } },
      channelItem: { select: { externalStatus: true, isKit: true } },
    },
  });
  if (row === null) return null;
  return {
    productId: row.id,
    isActive: row.isActive,
    externalStatus: row.channelItem?.externalStatus ?? '',
    names: Object.fromEntries(row.translations.map((t) => [t.locale, t.name])),
    descriptions: Object.fromEntries(row.translations.map((t) => [t.locale, t.description])),
    brandName: row.brandName,
    shippingSizeTier: row.shippingSizeTier,
    isKit: row.channelItem?.isKit ?? false,
    isPreOrder: row.isPreOrder,
    releaseDate: row.releaseDate,
    images: row.images.map((image) => ({ url: image.url, position: image.position })),
    optionTypes: row.optionTypes.map((type) => ({
      id: type.id,
      name: type.name,
      position: type.position,
      values: type.values.map((value) => ({ id: value.id, value: value.value, position: value.position })),
    })),
    variants: row.variants.map((v) => ({
      variantId: v.id,
      position: v.position,
      priceSatang: v.priceSatang,
      originalPriceSatang: v.originalPriceSatang,
      stockQuantity: v.stockQuantity,
      isActive: v.isActive,
      optionValueIds: v.optionValues.map((link) => link.optionValueId),
    })),
  };
}
