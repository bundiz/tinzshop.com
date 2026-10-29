import { getPrisma } from '@/server/repositories/shared/prisma';

/**
 * Development aid until plan 002's admin screens exist: turns on every synced product whose
 * Shopee item is NORMAL and that has an active variant. Never deactivates. Returns the count changed.
 */
export async function activateSyncedProducts(): Promise<number> {
  const result = await getPrisma().product.updateMany({
    where: {
      isActive: false,
      channelItem: { is: { externalStatus: 'NORMAL' } },
      variants: { some: { isActive: true } },
    },
    data: { isActive: true },
  });
  return result.count;
}
