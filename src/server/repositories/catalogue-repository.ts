import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/server/repositories/prisma';
import type {
  CatalogueItemSnapshot,
  CatalogueVariantSnapshot,
  ListedItem,
} from '@/server/services/catalogue-snapshot';

const CHANNEL = 'shopee';
const NOT_FOUND = 'NOT_FOUND';
const ITEM_TRANSACTION_TIMEOUT_MS = 20_000;

type Json = Prisma.InputJsonValue | null;

/** Prisma Json cannot hold bigint (or Date), so ids become decimal strings at any depth. */
function toJson(value: unknown): Json {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => toJson(entry));
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, Json> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) out[key] = toJson(entry);
    }
    return out;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return null;
}

/** The column is NOT NULL, so a missing payload is stored as an empty object. */
function rawPayloadJson(value: unknown): Prisma.InputJsonValue {
  return toJson(value) ?? {};
}

function modelKey(externalModelId: bigint | null): string {
  return externalModelId === null ? 'none' : externalModelId.toString();
}

function itemFields(snapshot: CatalogueItemSnapshot, syncedAt: Date): Prisma.ChannelItemUncheckedUpdateInput {
  return {
    externalStatus: snapshot.externalStatus,
    externalCategoryId: snapshot.externalCategoryId,
    isKit: snapshot.isKit,
    externalCreatedAt: snapshot.externalCreatedAt,
    externalUpdatedAt: snapshot.externalUpdatedAt,
    // Unknown sales data (null) leaves the stored values alone.
    ...(snapshot.salesCount === null ? {} : { salesCount: snapshot.salesCount }),
    ...(snapshot.ratingStar === null ? {} : { ratingStar: snapshot.ratingStar }),
    ...(snapshot.ratingCount === null ? {} : { ratingCount: snapshot.ratingCount }),
    lastSyncedAt: syncedAt,
    rawPayload: rawPayloadJson(snapshot.rawPayload),
  };
}

function variantFields(variant: CatalogueVariantSnapshot): {
  modelSku: string | null;
  priceSatang: bigint;
  originalPriceSatang: bigint;
  stockQuantity: number;
  isActive: boolean;
  position: number;
} {
  return {
    modelSku: variant.modelSku,
    priceSatang: variant.priceSatang,
    originalPriceSatang: variant.originalPriceSatang,
    stockQuantity: variant.stockQuantity,
    isActive: variant.isActive,
    position: variant.position,
  };
}

/** Recreates the product's option types and values in snapshot order; returns value ids per type. */
async function rebuildOptions(
  tx: Prisma.TransactionClient,
  productId: string,
  snapshot: CatalogueItemSnapshot,
): Promise<string[][]> {
  await tx.optionType.deleteMany({ where: { productId } });
  const valueIds: string[][] = [];
  for (const [position, optionType] of snapshot.optionTypes.entries()) {
    const created = await tx.optionType.create({
      data: {
        productId,
        position,
        name: optionType.name,
        values: {
          create: optionType.values.map((value, valuePosition) => ({ position: valuePosition, value })),
        },
      },
      include: { values: { orderBy: { position: 'asc' } } },
    });
    valueIds.push(created.values.map((value) => value.id));
  }
  return valueIds;
}

function linkedValueIds(variant: CatalogueVariantSnapshot, valueIds: string[][]): { optionValueId: string }[] {
  return variant.optionIndexes.map((valueIndex, typeIndex) => {
    const optionValueId = valueIds[typeIndex]?.[valueIndex];
    if (optionValueId === undefined) {
      throw new Error(`Variant option index ${valueIndex} for option type ${typeIndex} has no matching value`);
    }
    return { optionValueId };
  });
}

async function createVariant(
  tx: Prisma.TransactionClient,
  productId: string,
  channelItemId: string,
  variant: CatalogueVariantSnapshot,
  valueIds: string[][],
  syncedAt: Date,
): Promise<void> {
  await tx.variant.create({
    data: {
      productId,
      ...variantFields(variant),
      optionValues: { create: linkedValueIds(variant, valueIds) },
      channelListing: {
        create: { channelItemId, externalModelId: variant.externalModelId, lastSyncedAt: syncedAt },
      },
    },
  });
}

async function createItem(
  tx: Prisma.TransactionClient,
  snapshot: CatalogueItemSnapshot,
  syncedAt: Date,
): Promise<void> {
  const product = await tx.product.create({
    data: {
      parentSku: snapshot.parentSku,
      brandName: snapshot.brandName,
      weightGrams: snapshot.weightGrams,
      isActive: false,
      translations: { create: { locale: 'th', name: snapshot.name, description: snapshot.description } },
      images: {
        create: snapshot.images.map((image, position) => ({
          position,
          url: image.url,
          externalImageId: image.externalImageId,
        })),
      },
    },
    select: { id: true },
  });
  const channelItem = await tx.channelItem.create({
    data: {
      productId: product.id,
      channel: CHANNEL,
      externalItemId: snapshot.externalItemId,
      externalStatus: snapshot.externalStatus,
      externalCategoryId: snapshot.externalCategoryId,
      isKit: snapshot.isKit,
      externalCreatedAt: snapshot.externalCreatedAt,
      externalUpdatedAt: snapshot.externalUpdatedAt,
      salesCount: snapshot.salesCount ?? 0,
      ratingStar: snapshot.ratingStar ?? 0,
      ratingCount: snapshot.ratingCount ?? 0,
      lastSyncedAt: syncedAt,
      rawPayload: rawPayloadJson(snapshot.rawPayload),
    },
    select: { id: true },
  });
  const valueIds = await rebuildOptions(tx, product.id, snapshot);
  for (const variant of snapshot.variants) {
    await createVariant(tx, product.id, channelItem.id, variant, valueIds, syncedAt);
  }
}

async function updateItem(
  tx: Prisma.TransactionClient,
  existing: { id: string; productId: string },
  snapshot: CatalogueItemSnapshot,
  syncedAt: Date,
): Promise<void> {
  const productId = existing.productId;
  // Shopee-sourced product fields only; the admin-owned ones are never written here.
  await tx.product.update({
    where: { id: productId },
    data: { parentSku: snapshot.parentSku, brandName: snapshot.brandName, weightGrams: snapshot.weightGrams },
  });
  await tx.channelItem.update({ where: { id: existing.id }, data: itemFields(snapshot, syncedAt) });
  await tx.productTranslation.upsert({
    where: { productId_locale: { productId, locale: 'th' } },
    create: { productId, locale: 'th', name: snapshot.name, description: snapshot.description },
    update: { name: snapshot.name, description: snapshot.description },
  });
  await tx.productImage.deleteMany({ where: { productId } });
  await tx.productImage.createMany({
    data: snapshot.images.map((image, position) => ({
      productId,
      position,
      url: image.url,
      externalImageId: image.externalImageId,
    })),
  });

  const valueIds = await rebuildOptions(tx, productId, snapshot);

  const listings = await tx.channelListing.findMany({ where: { channelItemId: existing.id } });
  const listingByModel = new Map(listings.map((listing) => [modelKey(listing.externalModelId), listing]));
  const seen = new Set<string>();

  for (const variant of snapshot.variants) {
    const key = modelKey(variant.externalModelId);
    seen.add(key);
    const listing = listingByModel.get(key);
    if (listing === undefined) {
      await createVariant(tx, productId, existing.id, variant, valueIds, syncedAt);
      continue;
    }
    await tx.variant.update({ where: { id: listing.variantId }, data: variantFields(variant) });
    await tx.channelListing.update({
      where: { id: listing.id },
      data: { externalStatus: null, lastSyncedAt: syncedAt },
    });
    await tx.variantOptionValue.createMany({
      data: linkedValueIds(variant, valueIds).map((link) => ({ variantId: listing.variantId, ...link })),
    });
  }

  for (const [key, listing] of listingByModel) {
    if (seen.has(key)) continue;
    await tx.variant.update({ where: { id: listing.variantId }, data: { isActive: false } });
    await tx.channelListing.update({
      where: { id: listing.id },
      data: { externalStatus: NOT_FOUND, lastSyncedAt: syncedAt },
    });
  }
}

export async function upsertCatalogueItem(
  snapshot: CatalogueItemSnapshot,
  syncedAt: Date,
): Promise<'created' | 'updated'> {
  return getPrisma().$transaction(
    async (tx) => {
      const existing = await tx.channelItem.findUnique({
        where: { channel_externalItemId: { channel: CHANNEL, externalItemId: snapshot.externalItemId } },
        select: { id: true, productId: true },
      });
      if (existing === null) {
        await createItem(tx, snapshot, syncedAt);
        return 'created';
      }
      await updateItem(tx, existing, snapshot, syncedAt);
      return 'updated';
    },
    { timeout: ITEM_TRANSACTION_TIMEOUT_MS },
  );
}

export async function listKnownItems(): Promise<ListedItem[]> {
  const rows = await getPrisma().channelItem.findMany({
    where: { channel: CHANNEL, externalStatus: { not: NOT_FOUND } },
    orderBy: { externalItemId: 'asc' },
    select: { externalItemId: true, externalStatus: true, isKit: true },
  });
  return rows.map((row) => ({
    externalItemId: row.externalItemId,
    externalStatus: row.externalStatus,
    isKit: row.isKit,
  }));
}

/** Marks items Shopee no longer returns; returns how many changed. Products and variants are kept. */
export async function markItemsNotFound(externalItemIds: readonly bigint[], syncedAt: Date): Promise<number> {
  if (externalItemIds.length === 0) return 0;
  const result = await getPrisma().channelItem.updateMany({
    where: {
      channel: CHANNEL,
      externalItemId: { in: [...externalItemIds] },
      externalStatus: { not: NOT_FOUND },
    },
    data: { externalStatus: NOT_FOUND, lastSyncedAt: syncedAt },
  });
  return result.count;
}
