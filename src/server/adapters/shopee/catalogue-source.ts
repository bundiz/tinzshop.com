import {
  SALES_DATA_UNAVAILABLE,
  type CatalogueItemSnapshot,
  type CatalogueSource,
  type ListedItem,
} from "../../services/catalogue-snapshot";
import { CatalogueSourceError } from "../../services/catalogue-sync-service";
import type { ShopeeClient } from "./client";
import { ShopeeApiError } from "./errors";
import { CatalogueMappingError, mapShopeeItem } from "./map-item";
import type { ShopeeItemBaseInfoBatch, ShopeeItemExtraInfo, ShopeeShopCredentials } from "./schemas";

const PAGE_SIZE = 50;
const BATCH_SIZE = 50;
const MAX_LIST_PAGES = 1000;

type Credentials = () => Promise<{ accessToken: string; externalShopId: bigint }>;

function isKitFlagged(item: object): boolean {
  if (!("tag" in item)) return false;
  const tag = item.tag;
  return typeof tag === "object" && tag !== null && "kit" in tag && tag.kit === true;
}

/** Per-item failure reason; anything else (credentials, programming errors) is not an item failure. */
function reasonOf(error: unknown): string {
  if (error instanceof ShopeeApiError) return error.shopeeError;
  if (error instanceof CatalogueMappingError) return "mapping_failed";
  throw error;
}

export function createShopeeCatalogueSource(deps: {
  client: ShopeeClient;
  credentials: Credentials;
}): CatalogueSource {
  const { client } = deps;
  // The client is shared across runs, so this source reports only the calls made since it was created.
  const callBaseline = client.callCount();

  // Asked before every request so a token refreshed mid-run is picked up.
  async function fresh(): Promise<ShopeeShopCredentials> {
    const { accessToken, externalShopId } = await deps.credentials();
    return { accessToken, shopId: externalShopId };
  }

  return {
    async listItems(window) {
      const items: ListedItem[] = [];
      let offset = 0;
      try {
        for (let pages = 0; ; pages += 1) {
          if (pages >= MAX_LIST_PAGES) throw new CatalogueSourceError("listing_too_long");
          const page = await client.getItemList(await fresh(), {
            offset,
            pageSize: PAGE_SIZE,
            itemStatuses: ["NORMAL", "UNLIST"],
            ...(window === null ? {} : { updateTimeFrom: window.from, updateTimeTo: window.to }),
          });
          for (const item of page.item) {
            items.push({
              externalItemId: item.item_id,
              externalStatus: item.item_status,
              isKit: isKitFlagged(item),
            });
          }
          if (!page.has_next_page) break;
          // A page that claims more but is empty or does not advance would end a run on a partial listing.
          if (page.item.length === 0) throw new CatalogueSourceError("listing_incomplete");
          if (page.next_offset === undefined || page.next_offset <= offset) {
            throw new CatalogueSourceError("listing_stuck");
          }
          offset = page.next_offset;
        }
      } catch (error) {
        if (error instanceof ShopeeApiError) throw new CatalogueSourceError(error.shopeeError);
        throw error;
      }
      return items;
    },

    async fetchItems(items) {
      const snapshots: CatalogueItemSnapshot[] = [];
      const notFound: bigint[] = [];
      const failures: { externalItemId: bigint; reason: string }[] = [];
      const unique = [...new Map(items.map((item) => [item.externalItemId, item])).values()];

      for (let start = 0; start < unique.length; start += BATCH_SIZE) {
        const batch = unique.slice(start, start + BATCH_SIZE);
        const ids = batch.map((item) => item.externalItemId);

        let batchInfo: ShopeeItemBaseInfoBatch;
        try {
          batchInfo = await client.getItemBaseInfo(await fresh(), ids);
        } catch (error) {
          if (!(error instanceof ShopeeApiError)) throw error;
          for (const id of ids) failures.push({ externalItemId: id, reason: error.shopeeError });
          continue;
        }
        const baseInfos = batchInfo.items;
        if (baseInfos.length === 0 && batchInfo.invalid.length === 0) {
          for (const id of ids) failures.push({ externalItemId: id, reason: "empty_batch_response" });
          continue;
        }
        const invalidIds = new Set(batchInfo.invalid.filter((id): id is bigint => id !== null));
        // An element without a readable id could be any missing id, so none of them is not-found.
        const missingIsUnknown = batchInfo.invalid.some((id) => id === null);

        let extraInfos: ShopeeItemExtraInfo[] | null = null;
        try {
          extraInfos = await client.getItemExtraInfo(await fresh(), ids);
        } catch (error) {
          // Sales and rating are non-essential: map without them.
          if (!(error instanceof ShopeeApiError)) throw error;
        }

        const baseById = new Map(baseInfos.map((info) => [info.item_id, info]));
        const extraById = new Map((extraInfos ?? []).map((info) => [info.item_id, info]));
        for (const item of batch) {
          const baseInfo = baseById.get(item.externalItemId);
          if (baseInfo === undefined) {
            if (invalidIds.has(item.externalItemId) || missingIsUnknown) {
              failures.push({ externalItemId: item.externalItemId, reason: "invalid_response" });
            } else {
              notFound.push(item.externalItemId);
            }
            continue;
          }
          try {
            const modelList = baseInfo.has_model
              ? await client.getModelList(await fresh(), item.externalItemId)
              : null;
            const extraInfo = extraById.get(item.externalItemId) ?? null;
            snapshots.push(mapShopeeItem({ baseInfo, modelList, extraInfo, isKit: item.isKit }));
            if (extraInfo === null) {
              // Mapped, but without sales data: surfaced as a run warning.
              failures.push({ externalItemId: item.externalItemId, reason: SALES_DATA_UNAVAILABLE });
            }
          } catch (error) {
            failures.push({ externalItemId: item.externalItemId, reason: reasonOf(error) });
          }
        }
      }
      return { snapshots, notFound, failures };
    },

    apiCallCount() {
      return client.callCount() - callBaseline;
    },
  };
}
