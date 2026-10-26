import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CatalogueSourceError } from "../../services/catalogue-sync-service";
import { createShopeeCatalogueSource } from "./catalogue-source";
import type { ShopeeClient } from "./client";
import { ShopeeApiError } from "./errors";
import {
  shopeeItemBaseInfoResponseSchema,
  shopeeItemExtraInfoResponseSchema,
  shopeeItemListPageSchema,
  shopeeModelListSchema,
  type ShopeeItemBaseInfo,
  type ShopeeItemExtraInfo,
  type ShopeeItemListPage,
  type ShopeeModelList,
} from "./schemas";

function fixture(name: string): unknown {
  const parsed: unknown = JSON.parse(readFileSync(join(__dirname, "__fixtures__", name), "utf8"));
  if (typeof parsed === "object" && parsed !== null && "response" in parsed) return parsed.response;
  return parsed;
}

const baseInfos: ShopeeItemBaseInfo[] = shopeeItemBaseInfoResponseSchema.parse(
  fixture("item-base-info.json"),
).item_list;
const extraInfos: ShopeeItemExtraInfo[] = shopeeItemExtraInfoResponseSchema.parse(
  fixture("item-extra-info.json"),
).item_list;
const modelList: ShopeeModelList = shopeeModelListSchema.parse(fixture("model-list-803947690.json"));
const listPage: ShopeeItemListPage = shopeeItemListPageSchema.parse(fixture("item-list.json"));

const TWO_TIER = 803947690n;
const NO_MODEL = 803947687n;

const credentials = async (): Promise<{ accessToken: string; externalShopId: bigint }> => ({
  accessToken: "token",
  externalShopId: 227679200n,
});

type Fake = {
  client: ShopeeClient;
  baseCalls: bigint[][];
  listCalls: { offset: number; updateTimeFrom?: Date; updateTimeTo?: Date; itemStatuses: readonly string[] }[];
  credentialCalls: { count: number };
};

function fake(overrides: Partial<ShopeeClient> = {}): Fake {
  const baseCalls: bigint[][] = [];
  const listCalls: Fake["listCalls"] = [];
  const client: ShopeeClient = {
    getAccessToken: () => Promise.reject(new Error("unused")),
    refreshAccessToken: () => Promise.reject(new Error("unused")),
    getItemList: (_c, query) => {
      listCalls.push(query);
      return Promise.resolve(listPage);
    },
    getItemBaseInfo: (_c, ids) => {
      baseCalls.push([...ids]);
      return Promise.resolve(baseInfos.filter((info) => ids.includes(info.item_id)));
    },
    getModelList: () => Promise.resolve(modelList),
    getItemExtraInfo: (_c, ids) =>
      Promise.resolve(extraInfos.filter((info) => ids.includes(info.item_id))),
    callCount: () => 0,
    ...overrides,
  };
  return { client, baseCalls, listCalls, credentialCalls: { count: 0 } };
}

function listed(id: bigint): { externalItemId: bigint; externalStatus: string; isKit: boolean } {
  return { externalItemId: id, externalStatus: "NORMAL", isKit: false };
}

describe("shopee catalogue source", () => {
  it("fetches base info in batches of 50", async () => {
    const { client, baseCalls } = fake();
    const source = createShopeeCatalogueSource({ client, credentials });
    const ids = Array.from({ length: 58 }, (_, i) => BigInt(900000000 + i));
    const items = [TWO_TIER, NO_MODEL, ...ids].map(listed);
    await source.fetchItems(items);
    expect(baseCalls.map((call) => call.length)).toEqual([50, 10]);
  });

  it("reports ids missing from a non-empty batch as not found", async () => {
    const { client } = fake();
    const source = createShopeeCatalogueSource({ client, credentials });
    const result = await source.fetchItems([listed(TWO_TIER), listed(999n)]);
    expect(result.notFound).toEqual([999n]);
    expect(result.snapshots.map((s) => s.externalItemId)).toEqual([TWO_TIER]);
    expect(result.failures).toEqual([]);
  });

  it("treats an empty batch response as failures, not as not-found", async () => {
    const { client } = fake({ getItemBaseInfo: () => Promise.resolve([]) });
    const source = createShopeeCatalogueSource({ client, credentials });
    const result = await source.fetchItems([listed(TWO_TIER), listed(NO_MODEL)]);
    expect(result.notFound).toEqual([]);
    expect(result.snapshots).toEqual([]);
    expect(result.failures).toEqual([
      { externalItemId: TWO_TIER, reason: "empty_batch_response" },
      { externalItemId: NO_MODEL, reason: "empty_batch_response" },
    ]);
  });

  it("isolates a model-list failure to its item", async () => {
    const { client } = fake({
      getModelList: () =>
        Promise.reject(
          new ShopeeApiError({ path: "/api/v2/product/get_model_list", shopeeError: "error_server", httpStatus: 500 }),
        ),
    });
    const source = createShopeeCatalogueSource({ client, credentials });
    const result = await source.fetchItems([listed(TWO_TIER), listed(NO_MODEL)]);
    expect(result.snapshots.map((s) => s.externalItemId)).toEqual([NO_MODEL]);
    expect(result.failures).toEqual([{ externalItemId: TWO_TIER, reason: "error_server" }]);
  });

  it("fails every id of a batch whose base-info call fails and keeps going", async () => {
    let call = 0;
    const { client } = fake({
      getItemBaseInfo: (_c, ids) => {
        call += 1;
        if (call === 1) {
          return Promise.reject(
            new ShopeeApiError({ path: "/p", shopeeError: "error_server", httpStatus: 500 }),
          );
        }
        return Promise.resolve(baseInfos.filter((info) => ids.includes(info.item_id)));
      },
    });
    const source = createShopeeCatalogueSource({ client, credentials });
    const filler = Array.from({ length: 50 }, (_, i) => BigInt(900000000 + i));
    const result = await source.fetchItems([...filler, TWO_TIER].map(listed));
    expect(result.failures).toHaveLength(50);
    expect(result.failures[0]?.reason).toBe("error_server");
    expect(result.snapshots.map((s) => s.externalItemId)).toEqual([TWO_TIER]);
  });

  it("maps items without extra info when the extra-info call fails", async () => {
    const { client } = fake({
      getItemExtraInfo: () =>
        Promise.reject(new ShopeeApiError({ path: "/p", shopeeError: "error_server", httpStatus: 500 })),
    });
    const source = createShopeeCatalogueSource({ client, credentials });
    const result = await source.fetchItems([listed(NO_MODEL)]);
    expect(result.failures).toEqual([]);
    expect(result.snapshots[0]?.salesCount).toBe(0);
  });

  it("passes the window to get_item_list and pages until has_next_page is false", async () => {
    const pages: ShopeeItemListPage[] = [
      { ...listPage, has_next_page: true, next_offset: 50 },
      { ...listPage, item: [{ item_id: 5n, item_status: "UNLIST", update_time: 1 }], has_next_page: false },
    ];
    const { client, listCalls } = fake({
      getItemList: (_c, query) => {
        listCalls.push(query);
        const page = pages[listCalls.length - 1];
        if (page === undefined) return Promise.reject(new Error("too many pages"));
        return Promise.resolve(page);
      },
    });
    const source = createShopeeCatalogueSource({ client, credentials });
    const from = new Date("2026-10-26T00:50:00.000Z");
    const to = new Date("2026-10-26T01:00:00.000Z");
    const items = await source.listItems({ from, to });
    expect(listCalls.map((c) => c.offset)).toEqual([0, 50]);
    expect(listCalls[0]?.updateTimeFrom).toEqual(from);
    expect(listCalls[0]?.updateTimeTo).toEqual(to);
    expect(listCalls[0]?.itemStatuses).toEqual(["NORMAL", "UNLIST"]);
    expect(items.map((i) => i.externalItemId)).toEqual([TWO_TIER, NO_MODEL, 5n]);
    expect(items[2]?.externalStatus).toBe("UNLIST");
  });

  it("omits the window when it is null", async () => {
    const { client, listCalls } = fake();
    const source = createShopeeCatalogueSource({ client, credentials });
    await source.listItems(null);
    expect(listCalls[0]?.updateTimeFrom).toBeUndefined();
    expect(listCalls[0]?.updateTimeTo).toBeUndefined();
  });

  it("converts a listing error into a CatalogueSourceError carrying the Shopee code", async () => {
    const { client } = fake({
      getItemList: () =>
        Promise.reject(new ShopeeApiError({ path: "/p", shopeeError: "error_auth", httpStatus: 403 })),
    });
    const source = createShopeeCatalogueSource({ client, credentials });
    await expect(source.listItems(null)).rejects.toMatchObject({
      code: "error_auth",
      name: "CatalogueSourceError",
    });
    await expect(source.listItems(null)).rejects.toBeInstanceOf(CatalogueSourceError);
  });

  it("asks for credentials lazily, never at construction", async () => {
    let calls = 0;
    const { client } = fake();
    const source = createShopeeCatalogueSource({
      client,
      credentials: async () => {
        calls += 1;
        return credentials();
      },
    });
    expect(calls).toBe(0);
    await source.listItems(null);
    expect(calls).toBeGreaterThan(0);
  });
});
