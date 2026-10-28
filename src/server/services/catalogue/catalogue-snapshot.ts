export type CatalogueVariantSnapshot = {
  externalModelId: bigint | null;
  modelSku: string | null;
  priceSatang: bigint;
  originalPriceSatang: bigint;
  stockQuantity: number;
  isActive: boolean;
  position: number;
  optionIndexes: readonly number[];
};

export type CatalogueItemSnapshot = {
  externalItemId: bigint;
  externalStatus: string;
  externalCategoryId: bigint;
  isKit: boolean;
  externalCreatedAt: Date;
  externalUpdatedAt: Date;
  parentSku: string | null;
  name: string;
  description: string;
  brandName: string | null;
  weightGrams: number | null;
  images: readonly { url: string; externalImageId: string }[];
  optionTypes: readonly { name: string; values: readonly string[] }[];
  variants: readonly CatalogueVariantSnapshot[];
  /** null = the source could not say; a stored value is then kept, never overwritten. */
  salesCount: number | null;
  ratingStar: number | null;
  ratingCount: number | null;
  rawPayload: unknown;
};

export type ListedItem = {
  externalItemId: bigint;
  externalStatus: string;
  isKit: boolean;
};

/**
 * Failure reason for an item that was mapped without its sales and rating data. It is a warning only:
 * the item's snapshot is still returned and upserted.
 */
export const SALES_DATA_UNAVAILABLE = 'extra_info_unavailable';

export type CatalogueSource = {
  listItems(window: { from: Date; to: Date } | null): Promise<ListedItem[]>;
  fetchItems(items: readonly ListedItem[]): Promise<{
    snapshots: CatalogueItemSnapshot[];
    /** Ids absent from a source response that was otherwise valid. */
    notFound: bigint[];
    failures: { externalItemId: bigint; reason: string }[];
  }>;
  /** Calls made by this source since it was created. */
  apiCallCount(): number;
};
