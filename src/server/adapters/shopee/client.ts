import { ShopeeApiError } from "./errors";
import {
  shopeeItemBaseInfoEnvelopeSchema,
  shopeeItemBaseInfoSchema,
  shopeeItemExtraInfoResponseSchema,
  shopeeItemListPageSchema,
  shopeeModelListSchema,
  shopeeTokenResponseSchema,
  type ShopeeItemBaseInfo,
  type ShopeeItemBaseInfoBatch,
  type ShopeeItemExtraInfo,
  type ShopeeItemListPage,
  type ShopeeItemStatus,
  type ShopeeModelList,
  type ShopeeShopCredentials,
  type ShopeeTokenSet,
} from "./schemas";
import { signPublicRequest, signShopRequest } from "./sign";

const MAX_IDS = 50;
const DEFAULT_TIMEOUT_MS = 20_000;

export interface ShopeeClientOptions {
  baseUrl: string;
  partnerId: number;
  partnerKey: string;
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

export interface ShopeeItemListQuery {
  offset: number;
  pageSize: number;
  itemStatuses: readonly ShopeeItemStatus[];
  updateTimeFrom?: Date;
  updateTimeTo?: Date;
}

export interface ShopeeClient {
  getAccessToken(input: { code: string; shopId: bigint }): Promise<ShopeeTokenSet>;
  refreshAccessToken(input: { refreshToken: string; shopId: bigint }): Promise<ShopeeTokenSet>;
  getItemList(
    credentials: ShopeeShopCredentials,
    query: ShopeeItemListQuery,
  ): Promise<ShopeeItemListPage>;
  getItemBaseInfo(
    credentials: ShopeeShopCredentials,
    itemIds: readonly bigint[],
  ): Promise<ShopeeItemBaseInfoBatch>;
  getModelList(credentials: ShopeeShopCredentials, itemId: bigint): Promise<ShopeeModelList>;
  getItemExtraInfo(
    credentials: ShopeeShopCredentials,
    itemIds: readonly bigint[],
  ): Promise<ShopeeItemExtraInfo[]>;
  callCount(): number;
}

interface Parser<T> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: readonly { path: readonly PropertyKey[]; code: string }[] } };
}

type QueryValue = string | number | bigint | readonly (string | number | bigint)[];

function toJsonNumber(id: bigint): number {
  const n = Number(id);
  if (!Number.isSafeInteger(n)) {
    throw new RangeError("Shopee id is not a safe integer");
  }
  return n;
}

function seconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function assertIdCount(ids: readonly bigint[]): void {
  if (ids.length > MAX_IDS) {
    throw new RangeError(`At most ${MAX_IDS} ids per call`);
  }
}

/** The element's item_id when it is a safe integer, else null. */
function readItemId(element: unknown): bigint | null {
  if (typeof element !== "object" || element === null || !("item_id" in element)) return null;
  const id = element.item_id;
  return typeof id === "number" && Number.isSafeInteger(id) ? BigInt(id) : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export function createShopeeClient(options: ShopeeClientOptions): ShopeeClient {
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? ((): Date => new Date());
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let calls = 0;

  async function send(
    method: "GET" | "POST",
    path: string,
    query: Record<string, QueryValue | undefined>,
    body: unknown,
  ): Promise<{ status: number; json: unknown }> {
    const url = new URL(path, options.baseUrl);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (typeof value === "object") {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    calls += 1;
    let response: Response;
    let text: string;
    try {
      response = await doFetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      text = await response.text();
    } catch (error) {
      // The original error text may contain the URL, so it is not chained.
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      throw new ShopeeApiError({
        path,
        shopeeError: timedOut ? "timeout" : "network_error",
        httpStatus: 0,
      });
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ShopeeApiError({
        path,
        shopeeError: "non_json_response",
        httpStatus: response.status,
      });
    }

    if (typeof json === "object" && json !== null) {
      const envelope: Record<string, unknown> = { ...json };
      const shopeeError = readString(envelope.error);
      if (shopeeError !== null) {
        throw new ShopeeApiError({
          path,
          shopeeError,
          requestId: readString(envelope.request_id),
          httpStatus: response.status,
        });
      }
    }
    return { status: response.status, json };
  }

  function parse<T>(
    schema: Parser<T>,
    path: string,
    status: number,
    data: unknown,
  ): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      const detail = result.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.map(String).join(".") || "response"}: ${issue.code}`)
        .join("; ");
      throw new ShopeeApiError({ path, shopeeError: "invalid_response", httpStatus: status, detail });
    }
    return result.data;
  }

  function unwrap(json: unknown): unknown {
    if (typeof json === "object" && json !== null && "response" in json) {
      return json.response;
    }
    return undefined;
  }

  async function callPublic<T>(
    path: string,
    body: Record<string, unknown>,
    schema: Parser<T>,
  ): Promise<T> {
    const timestamp = seconds(now());
    const sign = signPublicRequest({
      partnerKey: options.partnerKey,
      partnerId: options.partnerId,
      path,
      timestamp,
    });
    const { status, json } = await send(
      "POST",
      path,
      { partner_id: options.partnerId, timestamp, sign },
      body,
    );
    return parse(schema, path, status, json);
  }

  async function callShop<T>(
    credentials: ShopeeShopCredentials,
    path: string,
    query: Record<string, QueryValue | undefined>,
    schema: Parser<T>,
  ): Promise<T> {
    const timestamp = seconds(now());
    const sign = signShopRequest({
      partnerKey: options.partnerKey,
      partnerId: options.partnerId,
      path,
      timestamp,
      accessToken: credentials.accessToken,
      shopId: credentials.shopId,
    });
    const { status, json } = await send(
      "GET",
      path,
      {
        ...query,
        partner_id: options.partnerId,
        timestamp,
        access_token: credentials.accessToken,
        shop_id: credentials.shopId,
        sign,
      },
      undefined,
    );
    return parse(schema, path, status, unwrap(json));
  }

  function toTokenSet(raw: {
    access_token: string;
    refresh_token: string;
    expire_in: number;
  }): ShopeeTokenSet {
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      expiresInSeconds: raw.expire_in,
    };
  }

  return {
    async getAccessToken({ code, shopId }) {
      const raw = await callPublic(
        "/api/v2/auth/token/get",
        { code, shop_id: toJsonNumber(shopId), partner_id: options.partnerId },
        shopeeTokenResponseSchema,
      );
      return toTokenSet(raw);
    },

    async refreshAccessToken({ refreshToken, shopId }) {
      const raw = await callPublic(
        "/api/v2/auth/access_token/get",
        {
          shop_id: toJsonNumber(shopId),
          refresh_token: refreshToken,
          partner_id: options.partnerId,
        },
        shopeeTokenResponseSchema,
      );
      return toTokenSet(raw);
    },

    getItemList(credentials, query) {
      return callShop(
        credentials,
        "/api/v2/product/get_item_list",
        {
          offset: query.offset,
          page_size: query.pageSize,
          item_status: query.itemStatuses,
          update_time_from:
            query.updateTimeFrom === undefined ? undefined : seconds(query.updateTimeFrom),
          update_time_to:
            query.updateTimeTo === undefined ? undefined : seconds(query.updateTimeTo),
        },
        shopeeItemListPageSchema,
      );
    },

    async getItemBaseInfo(credentials, itemIds) {
      assertIdCount(itemIds);
      const raw = await callShop(
        credentials,
        "/api/v2/product/get_item_base_info",
        { item_id_list: itemIds.join(",") },
        shopeeItemBaseInfoEnvelopeSchema,
      );
      const items: ShopeeItemBaseInfo[] = [];
      const invalid: (bigint | null)[] = [];
      for (const element of raw.item_list) {
        const parsed = shopeeItemBaseInfoSchema.safeParse(element);
        if (parsed.success) items.push(parsed.data);
        else invalid.push(readItemId(element));
      }
      return { items, invalid };
    },

    getModelList(credentials, itemId) {
      return callShop(
        credentials,
        "/api/v2/product/get_model_list",
        { item_id: itemId },
        shopeeModelListSchema,
      );
    },

    async getItemExtraInfo(credentials, itemIds) {
      assertIdCount(itemIds);
      const raw = await callShop(
        credentials,
        "/api/v2/product/get_item_extra_info",
        { item_id_list: itemIds.join(",") },
        shopeeItemExtraInfoResponseSchema,
      );
      return raw.item_list;
    },

    callCount() {
      return calls;
    },
  };
}
