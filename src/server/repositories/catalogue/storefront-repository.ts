import { getPrisma } from '@/server/repositories/shared/prisma';
import type { StorefrontCandidate } from '@/server/services/catalogue/landing-catalogue-service';

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
