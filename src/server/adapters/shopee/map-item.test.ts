import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  shopeeItemBaseInfoResponseSchema,
  shopeeItemExtraInfoResponseSchema,
  shopeeModelListSchema,
  type ShopeeItemBaseInfo,
  type ShopeeItemExtraInfo,
  type ShopeeModelList,
} from "./schemas";
import { CatalogueMappingError, mapShopeeItem } from "./map-item";

function fixture(name: string): unknown {
  const raw: unknown = JSON.parse(
    readFileSync(join(__dirname, "__fixtures__", name), "utf8"),
  );
  if (typeof raw !== "object" || raw === null || !("response" in raw)) {
    throw new Error(`bad fixture ${name}`);
  }
  return raw.response;
}

const baseItems = shopeeItemBaseInfoResponseSchema.parse(
  fixture("item-base-info.json"),
).item_list;
const extraItems = shopeeItemExtraInfoResponseSchema.parse(
  fixture("item-extra-info.json"),
).item_list;
const modelList: ShopeeModelList = shopeeModelListSchema.parse(
  fixture("model-list-803947690.json"),
);

function base(id: bigint): ShopeeItemBaseInfo {
  const found = baseItems.find((i) => i.item_id === id);
  if (!found) throw new Error("missing fixture item");
  return found;
}
function extra(id: bigint): ShopeeItemExtraInfo {
  const found = extraItems.find((i) => i.item_id === id);
  if (!found) throw new Error("missing fixture extra");
  return found;
}

const twoTier = () => ({
  baseInfo: base(803947690n),
  modelList,
  extraInfo: null,
  isKit: false,
});
const noModel = () => ({
  baseInfo: base(803947687n),
  modelList: null,
  extraInfo: extra(803947687n),
  isKit: false,
});

describe("mapShopeeItem", () => {
  it("maps a two-tier item", () => {
    const s = mapShopeeItem(twoTier());
    expect(s.optionTypes).toEqual([
      { name: "Capacity", values: ["1TB", "2TB"] },
      { name: "Colour", values: ["Black", "Blue"] },
    ]);
    expect(s.variants).toHaveLength(4);
    const v = s.variants.find((x) => x.externalModelId === 12998741n);
    expect(v).toMatchObject({
      modelSku: "SBX-IT-SSD-1TB-BLU",
      priceSatang: 299000n,
      stockQuantity: 2,
      optionIndexes: [0, 1],
      isActive: true,
    });
    expect(s.parentSku).toBe("SBX-IT-SSD");
    expect(s.weightGrams).toBe(200);
    expect(s.brandName).toBe("NoBrand");
    expect(s.images[0]?.url).toBe(
      "https://cf.shopee.co.th/file/sg-11134201-81z1k-muj2ro5yyn7mb3",
    );
    expect(s.images[0]?.externalImageId).toBe(
      "sg-11134201-81z1k-muj2ro5yyn7mb3",
    );
    expect(s.externalCreatedAt).toEqual(new Date(1793004278_000));
    expect(s.externalUpdatedAt).toEqual(new Date(1793004285_000));
  });

  it("orders variants by tier_index and numbers positions from 0", () => {
    const s = mapShopeeItem(twoTier());
    expect(s.variants.map((v) => v.optionIndexes)).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
    expect(s.variants.map((v) => v.position)).toEqual([0, 1, 2, 3]);
  });

  it("maps an item without models to one variant", () => {
    const s = mapShopeeItem(noModel());
    expect(s.optionTypes).toEqual([]);
    expect(s.variants).toHaveLength(1);
    expect(s.variants[0]).toMatchObject({
      externalModelId: null,
      modelSku: "SBX-SW-MK8",
      priceSatang: 159000n,
      stockQuantity: 12,
      position: 0,
    });
  });

  it("turns an empty SKU into null", () => {
    const input = noModel();
    const s = mapShopeeItem({
      ...input,
      baseInfo: { ...input.baseInfo, item_sku: "" },
    });
    expect(s.parentSku).toBeNull();
  });

  it("falls back to update_time when create_time is absent", () => {
    const input = noModel();
    const { create_time: _unused, ...rest } = input.baseInfo;
    void _unused;
    const s = mapShopeeItem({ ...input, baseInfo: rest });
    expect(s.externalCreatedAt).toEqual(s.externalUpdatedAt);
  });

  it("deactivates a model that is not MODEL_NORMAL", () => {
    const models = modelList.model.map((m, i) =>
      i === 0 ? { ...m, model_status: "MODEL_UNAVAILABLE" } : m,
    );
    const s = mapShopeeItem({
      ...twoTier(),
      modelList: { ...modelList, model: models },
    });
    expect(s.variants.filter((v) => !v.isActive)).toHaveLength(1);
  });

  it("uses extra info when present and zero when absent", () => {
    const s = mapShopeeItem(noModel());
    expect([s.salesCount, s.ratingStar, s.ratingCount]).toEqual([5, 4.5, 2]);
    const z = mapShopeeItem({ ...noModel(), extraInfo: null });
    expect([z.salesCount, z.ratingStar, z.ratingCount]).toEqual([0, 0, 0]);
  });

  it("parses weight given as text or number", () => {
    const w = (weight: string | number): number | null =>
      mapShopeeItem({
        ...noModel(),
        baseInfo: { ...base(803947687n), weight },
      }).weightGrams;
    expect(w("0.2")).toBe(200);
    expect(w(0.2)).toBe(200);
    expect(w("abc")).toBeNull();
  });

  it("refuses an item marked has_model without a model list", () => {
    expect(() => mapShopeeItem({ ...twoTier(), modelList: null })).toThrow(
      CatalogueMappingError,
    );
  });

  it("refuses a tier_index outside the option list", () => {
    const models = modelList.model.map((m, i) =>
      i === 0 ? { ...m, tier_index: [0, 9] } : m,
    );
    expect(() =>
      mapShopeeItem({
        ...twoTier(),
        modelList: { ...modelList, model: models },
      }),
    ).toThrow(CatalogueMappingError);
  });

  it("refuses a tier_index of the wrong length", () => {
    const models = modelList.model.map((m, i) =>
      i === 0 ? { ...m, tier_index: [0] } : m,
    );
    expect(() =>
      mapShopeeItem({
        ...twoTier(),
        modelList: { ...modelList, model: models },
      }),
    ).toThrow(CatalogueMappingError);
  });

  it("refuses a price that cannot be converted", () => {
    const { price_info: _p, ...rest } = base(803947687n);
    void _p;
    expect(() => mapShopeeItem({ ...noModel(), baseInfo: rest })).toThrow(
      CatalogueMappingError,
    );
    expect(() =>
      mapShopeeItem({
        ...noModel(),
        baseInfo: { ...rest, price_info: [{ current_price: 1.234 }] },
      }),
    ).toThrow(CatalogueMappingError);
  });
});
