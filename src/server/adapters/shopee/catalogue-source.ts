import type { CatalogueItemSnapshot, CatalogueSource, ListedItem } from "../../services/catalogue-snapshot";
import { CatalogueSourceError } from "../../services/catalogue-sync-service";
import type { ShopeeClient } from "./client";
import { ShopeeApiError } from "./errors";
import { mapShopeeItem } from "./map-item";
import type { ShopeeItemBaseInfo, ShopeeItemExtraInfo, ShopeeShopCredentials } from "./schemas";

const PAGE_SIZE = 50;
const BATCH_SIZE = 50;

type Credentials = () => Promise<{ accessToken: string; externalShopId: bigint }>;

function isKitFlagged(item: object): boolean {
  if (!("tag" in item)) return false;
  const tag = item.tag;
  return typeof tag === "object" && tag !== null && "kit" in tag && tag.kit === true;
}

function reasonOf(error: unknown): string {
  return error instanceof ShopeeApiError ? error.shopeeError : "mapping_failed";
}

export function createShopeeCatalogueSource(deps: {
  client: ShopeeClient;
  credentials: Credentials;
}): CatalogueSource {
  const { client } = deps;

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
        for (;;) {
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
          if (!page.has_next_page || page.item.length === 0) break;
          offset = page.next_offset ?? offset + page.item.length;
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

        let baseInfos: ShopeeItemBaseInfo[];
        try {
          baseInfos = await client.getItemBaseInfo(await fresh(), ids);
        } catch (error) {
          if (!(error instanceof ShopeeApiError)) throw error;
          for (const id of ids) failures.push({ externalItemId: id, reason: error.shopeeError });
          continue;
        }
        if (baseInfos.length === 0) {
          for (const id of ids) failures.push({ externalItemId: id, reason: "empty_batch_response" });
          continue;
        }

        let extraInfos: ShopeeItemExtraInfo[] = [];
        try {
          extraInfos = await client.getItemExtraInfo(await fresh(), ids);
        } catch (error) {
          // Sales and rating are non-essential: map without them.
          if (!(error instanceof ShopeeApiError)) throw error;
        }

        const baseById = new Map(baseInfos.map((info) => [info.item_id, info]));
        const extraById = new Map(extraInfos.map((info) => [info.item_id, info]));
        for (const item of batch) {
          const baseInfo = baseById.get(item.externalItemId);
          if (baseInfo === undefined) {
            notFound.push(item.externalItemId);
            continue;
          }
          try {
            const modelList = baseInfo.has_model
              ? await client.getModelList(await fresh(), item.externalItemId)
              : null;
            snapshots.push(
              mapShopeeItem({
                baseInfo,
                modelList,
                extraInfo: extraById.get(item.externalItemId) ?? null,
                isKit: item.isKit,
              }),
            );
          } catch (error) {
            failures.push({ externalItemId: item.externalItemId, reason: reasonOf(error) });
          }
        }
      }
      return { snapshots, notFound, failures };
    },

    apiCallCount() {
      return client.callCount();
    },
  };
}
