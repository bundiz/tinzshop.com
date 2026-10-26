import { bahtToSatang } from "../../services/money";
import type {
  CatalogueItemSnapshot,
  CatalogueVariantSnapshot,
} from "../../services/catalogue-snapshot";
import type {
  ShopeeItemBaseInfo,
  ShopeeItemExtraInfo,
  ShopeeModelList,
} from "./schemas";

export class CatalogueMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogueMappingError";
  }
}

type PriceInfo = { current_price: number; original_price?: number | undefined };
type StockInfo = { summary_info: { total_available_stock: number } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emptyToNull(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

function weightToGrams(weight: string | number | undefined): number | null {
  let kg: number;
  if (typeof weight === "number") {
    kg = weight;
  } else if (typeof weight === "string" && weight.trim() !== "") {
    kg = Number(weight.trim());
  } else {
    return null;
  }
  if (!Number.isFinite(kg) || kg < 0) return null;
  return Math.round(kg * 1000);
}

function priceOf(
  itemId: bigint,
  label: string,
  priceInfo: readonly PriceInfo[] | undefined,
): { priceSatang: bigint; originalPriceSatang: bigint } {
  const first = priceInfo?.[0];
  if (first === undefined) {
    throw new CatalogueMappingError(
      `Item ${itemId}: ${label} has no price_info`,
    );
  }
  try {
    const priceSatang = bahtToSatang(first.current_price);
    const originalPriceSatang =
      first.original_price === undefined
        ? priceSatang
        : bahtToSatang(first.original_price);
    return { priceSatang, originalPriceSatang };
  } catch (error) {
    if (error instanceof RangeError) {
      throw new CatalogueMappingError(
        `Item ${itemId}: ${label} has an invalid price (${error.message})`,
      );
    }
    throw error;
  }
}

function stockOf(stock: StockInfo | undefined): number {
  return stock?.summary_info.total_available_stock ?? 0;
}

function brandOf(baseInfo: ShopeeItemBaseInfo): string | null {
  const brand = baseInfo["brand"];
  if (!isRecord(brand)) return null;
  const name = brand["original_brand_name"];
  return typeof name === "string" && name !== "" ? name : null;
}

function imagesOf(
  baseInfo: ShopeeItemBaseInfo,
): { url: string; externalImageId: string }[] {
  const urls = baseInfo.image?.image_url_list ?? [];
  const rawIds = baseInfo.image?.["image_id_list"];
  const ids: unknown[] = Array.isArray(rawIds) ? rawIds : [];
  const count = Math.min(urls.length, ids.length);
  const images: { url: string; externalImageId: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const url = urls[i];
    const id = ids[i];
    if (url !== undefined && typeof id === "string") {
      images.push({ url, externalImageId: id });
    }
  }
  return images;
}

function compareTierIndex(a: readonly number[], b: readonly number[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] ?? -1) - (b[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return 0;
}

type OptionType = { name: string; values: readonly string[] };

function standardisedOptionTypes(
  modelList: ShopeeModelList,
): OptionType[] | null {
  const raw = modelList["standardise_tier_variation"];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const result: OptionType[] = [];
  for (const tier of raw) {
    if (!isRecord(tier)) return null;
    const name = tier["variation_name"];
    const options = tier["variation_option_list"];
    if (typeof name !== "string" || name === "" || !Array.isArray(options))
      return null;
    const values: string[] = [];
    for (const option of options) {
      if (!isRecord(option)) return null;
      const value = option["variation_option_name"];
      if (typeof value !== "string") return null;
      values.push(value);
    }
    result.push({ name, values });
  }
  return result;
}

function optionTypesOf(modelList: ShopeeModelList): OptionType[] {
  const standard = standardisedOptionTypes(modelList);
  if (
    standard !== null &&
    standard.length === modelList.tier_variation.length
  ) {
    return standard;
  }
  return modelList.tier_variation.map((tier) => ({
    name: tier.name,
    values: tier.option_list.map((option) => option.option),
  }));
}

function mapVariants(
  baseInfo: ShopeeItemBaseInfo,
  modelList: ShopeeModelList | null,
  optionTypes: readonly { name: string; values: readonly string[] }[],
): CatalogueVariantSnapshot[] {
  const itemId = baseInfo.item_id;
  if (!baseInfo.has_model) {
    return [
      {
        externalModelId: null,
        modelSku: emptyToNull(baseInfo.item_sku),
        ...priceOf(itemId, "the item", baseInfo.price_info),
        stockQuantity: stockOf(baseInfo.stock_info_v2),
        isActive: true,
        position: 0,
        optionIndexes: [],
      },
    ];
  }
  if (modelList === null || modelList.model.length === 0) {
    throw new CatalogueMappingError(
      `Item ${itemId}: has_model is true but no models were supplied`,
    );
  }
  const entries = modelList.model.map((model) => {
    const tierIndex = model.tier_index ?? [];
    if (tierIndex.length !== optionTypes.length) {
      throw new CatalogueMappingError(
        `Item ${itemId}: model ${model.model_id} has ${tierIndex.length} tier_index entries for ${optionTypes.length} option types`,
      );
    }
    tierIndex.forEach((optionIndex, tier) => {
      const values = optionTypes[tier]?.values ?? [];
      if (
        !Number.isInteger(optionIndex) ||
        optionIndex < 0 ||
        optionIndex >= values.length
      ) {
        throw new CatalogueMappingError(
          `Item ${itemId}: model ${model.model_id} tier_index ${optionIndex} is outside option type ${tier}`,
        );
      }
    });
    return { model, tierIndex };
  });
  entries.sort((a, b) => compareTierIndex(a.tierIndex, b.tierIndex));
  return entries.map(({ model, tierIndex }, position) => ({
    externalModelId: model.model_id,
    modelSku: emptyToNull(model.model_sku),
    ...priceOf(itemId, `model ${model.model_id}`, model.price_info),
    stockQuantity: stockOf(model.stock_info_v2),
    isActive: model.model_status === "MODEL_NORMAL",
    position,
    optionIndexes: tierIndex,
  }));
}

export function mapShopeeItem(input: {
  baseInfo: ShopeeItemBaseInfo;
  modelList: ShopeeModelList | null;
  extraInfo: ShopeeItemExtraInfo | null;
  isKit: boolean;
}): CatalogueItemSnapshot {
  const { baseInfo, modelList, extraInfo, isKit } = input;
  const optionTypes =
    baseInfo.has_model && modelList !== null ? optionTypesOf(modelList) : [];
  const variants = mapVariants(baseInfo, modelList, optionTypes);
  return {
    externalItemId: baseInfo.item_id,
    externalStatus: baseInfo.item_status,
    externalCategoryId: baseInfo.category_id,
    isKit,
    externalCreatedAt: new Date(
      (baseInfo.create_time ?? baseInfo.update_time) * 1000,
    ),
    externalUpdatedAt: new Date(baseInfo.update_time * 1000),
    parentSku: emptyToNull(baseInfo.item_sku),
    name: baseInfo.item_name,
    description: baseInfo.description ?? "",
    brandName: brandOf(baseInfo),
    weightGrams: weightToGrams(baseInfo.weight),
    images: imagesOf(baseInfo),
    optionTypes,
    variants,
    salesCount: extraInfo === null ? null : (extraInfo.sale ?? 0),
    ratingStar: extraInfo === null ? null : (extraInfo.rating_star ?? 0),
    ratingCount: extraInfo === null ? null : (extraInfo.comment_count ?? 0),
    rawPayload: baseInfo,
  };
}
