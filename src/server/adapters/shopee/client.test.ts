import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ShopeeApiError } from "./errors";
import { createShopeeClient } from "./client";

const PUBLIC_SIGN = "6aab77ee2280e403a38937412ca70e35114f12914ecb2c697ca10a6040598254";
const SHOP_SIGN = "e1e83b8cba981a89a0708d4684ab92e756b70e4efee746b95f495f58e79c7160";
const credentials = { accessToken: "test-access-token", shopId: 227679200n };

function fixture(name: string): string {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf8");
}

interface Recorded {
  url: URL;
  method: string | undefined;
  body: string | undefined;
}

function fakeFetch(
  respond: () => Response,
): { fetch: typeof fetch; requests: Recorded[] } {
  const requests: Recorded[] = [];
  const impl = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = typeof init?.body === "string" ? init.body : undefined;
    requests.push({ url: new URL(String(input)), method: init?.method, body });
    return Promise.resolve(respond());
  };
  return { fetch: impl, requests };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function build(respond: () => Response): {
  client: ReturnType<typeof createShopeeClient>;
  requests: Recorded[];
} {
  const { fetch: f, requests } = fakeFetch(respond);
  const client = createShopeeClient({
    baseUrl: "https://shopee.test",
    partnerId: 1000001,
    partnerKey: "test-partner-key",
    fetch: f,
    now: () => new Date(1700000000_000),
  });
  return { client, requests };
}

describe("shopee client", () => {
  it("getAccessToken posts code, shop_id and partner_id with a public signature", async () => {
    const { client, requests } = build(() =>
      json({ access_token: "a", refresh_token: "r", expire_in: 14400, error: "", message: "" }),
    );
    const result = await client.getAccessToken({ code: "abc", shopId: 227679200n });
    expect(result).toEqual({ accessToken: "a", refreshToken: "r", expiresInSeconds: 14400 });
    const req = requests[0];
    expect(req?.method).toBe("POST");
    expect(req?.url.pathname).toBe("/api/v2/auth/token/get");
    expect(req?.url.searchParams.get("partner_id")).toBe("1000001");
    expect(req?.url.searchParams.get("timestamp")).toBe("1700000000");
    expect(req?.url.searchParams.get("sign")).toBe(PUBLIC_SIGN);
    expect(JSON.parse(req?.body ?? "")).toEqual({
      code: "abc",
      shop_id: 227679200,
      partner_id: 1000001,
    });
  });

  it("refreshAccessToken posts refresh_token, shop_id and partner_id with a public signature", async () => {
    const { client, requests } = build(() =>
      json({ access_token: "a2", refresh_token: "r2", expire_in: 14400, error: "", message: "" }),
    );
    const result = await client.refreshAccessToken({ refreshToken: "r0", shopId: 227679200n });
    expect(result).toEqual({ accessToken: "a2", refreshToken: "r2", expiresInSeconds: 14400 });
    const req = requests[0];
    expect(req?.method).toBe("POST");
    expect(req?.url.pathname).toBe("/api/v2/auth/access_token/get");
    expect(req?.url.searchParams.get("partner_id")).toBe("1000001");
    expect(req?.url.searchParams.get("timestamp")).toBe("1700000000");
    expect(req?.url.searchParams.get("sign")).toBe(
      "a89623a2c6f2761df813b9bab322cecbeaa205ccbd559f114ff59094c51f6ef5",
    );
    expect(JSON.parse(req?.body ?? "")).toEqual({
      refresh_token: "r0",
      shop_id: 227679200,
      partner_id: 1000001,
    });
  });

  it("reports a timeout without leaking the URL", async () => {
    const failing = (): Promise<Response> =>
      Promise.reject(
        new DOMException("timed out https://x/?access_token=test-access-token", "TimeoutError"),
      );
    const client = createShopeeClient({
      baseUrl: "https://shopee.test",
      partnerId: 1000001,
      partnerKey: "test-partner-key",
      fetch: failing,
      now: () => new Date(1700000000_000),
    });
    const err = await client.getModelList(credentials, 1n).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ShopeeApiError);
    if (!(err instanceof ShopeeApiError)) throw new Error("unreachable");
    expect(err.shopeeError).toBe("timeout");
    expect(err.httpStatus).toBe(0);
    expect(String(err)).not.toContain("test-access-token");
    expect(String(err)).not.toContain("sign=");
  });

  it("getItemList signs with the shop signature and repeats item_status", async () => {
    const { client, requests } = build(() => new Response(fixture("item-list.json")));
    const page = await client.getItemList(credentials, {
      offset: 0,
      pageSize: 100,
      itemStatuses: ["NORMAL", "UNLIST"],
      updateTimeFrom: new Date(1699999000_000),
    });
    expect(page.item).toHaveLength(2);
    const url = requests[0]?.url;
    expect(requests[0]?.method).toBe("GET");
    expect(url?.searchParams.get("sign")).toBe(SHOP_SIGN);
    expect(url?.searchParams.getAll("item_status")).toEqual(["NORMAL", "UNLIST"]);
    expect(url?.searchParams.get("update_time_from")).toBe("1699999000");
    expect(url?.searchParams.get("page_size")).toBe("100");
    expect(url?.searchParams.get("shop_id")).toBe("227679200");
  });

  it("parses real sandbox base info", async () => {
    const { client, requests } = build(() => new Response(fixture("item-base-info.json")));
    const items = await client.getItemBaseInfo(credentials, [803947687n, 803947690n]);
    expect(items).toHaveLength(2);
    const ssd = items.find((i) => i.item_id === 803947690n);
    expect(ssd?.item_sku).toBe("SBX-IT-SSD");
    expect(ssd?.has_model).toBe(true);
    expect(requests[0]?.url.searchParams.get("item_id_list")).toBe("803947687,803947690");
  });

  it("parses real sandbox model list and extra info", async () => {
    const m = build(() => new Response(fixture("model-list-803947690.json")));
    const models = await m.client.getModelList(credentials, 803947690n);
    expect(models.model).toHaveLength(4);
    expect(models.model[0]?.model_id).toBe(12998741n);
    const e = build(() => new Response(fixture("item-extra-info.json")));
    const extra = await e.client.getItemExtraInfo(credentials, [803947687n]);
    expect(extra[0]?.sale).toBe(5);
  });

  it("rejects an item_id that is not a safe integer", async () => {
    const text = fixture("item-base-info.json").replace(
      /"item_id": 803947690/,
      '"item_id": 9007199254740993',
    );
    const { client } = build(() => new Response(text));
    await expect(client.getItemBaseInfo(credentials, [1n])).rejects.toThrow(ShopeeApiError);
  });

  it("refuses more than 50 ids", async () => {
    const { client, requests } = build(() => new Response(fixture("item-base-info.json")));
    const ids = Array.from({ length: 51 }, (_, i) => BigInt(i + 1));
    await expect(client.getItemBaseInfo(credentials, ids)).rejects.toThrow(RangeError);
    await expect(client.getItemExtraInfo(credentials, ids)).rejects.toThrow(RangeError);
    expect(requests).toHaveLength(0);
    expect(client.callCount()).toBe(0);
  });

  it("error messages never contain the token or the signature", async () => {
    const { client } = build(() =>
      json({ error: "error_auth", message: "Invalid access_token.", request_id: "r1" }),
    );
    const err = await client.getModelList(credentials, 1n).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ShopeeApiError);
    if (!(err instanceof ShopeeApiError)) throw new Error("unreachable");
    expect(err.shopeeError).toBe("error_auth");
    expect(err.requestId).toBe("r1");
    expect(err.message).toBe("/api/v2/product/get_model_list: error_auth");
    expect(String(err)).not.toContain("test-access-token");
    expect(String(err)).not.toContain("sign=");
  });

  it("reports a non-JSON response", async () => {
    const { client } = build(() => new Response("<html>bad gateway</html>", { status: 502 }));
    const err = await client.getModelList(credentials, 1n).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ShopeeApiError);
    if (!(err instanceof ShopeeApiError)) throw new Error("unreachable");
    expect(err.shopeeError).toBe("non_json_response");
    expect(err.httpStatus).toBe(502);
  });

  it("reports network failures without leaking the url", async () => {
    const failing = (): Promise<Response> =>
      Promise.reject(new Error("connect failed https://shopee.test/?access_token=test-access-token"));
    const client = createShopeeClient({
      baseUrl: "https://shopee.test",
      partnerId: 1000001,
      partnerKey: "test-partner-key",
      fetch: failing,
      now: () => new Date(1700000000_000),
    });
    const err = await client.getModelList(credentials, 1n).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ShopeeApiError);
    if (!(err instanceof ShopeeApiError)) throw new Error("unreachable");
    expect(err.shopeeError).toBe("network_error");
    expect(err.httpStatus).toBe(0);
    expect(String(err)).not.toContain("test-access-token");
    expect(client.callCount()).toBe(1);
  });

  it("reports schema failures as invalid_response", async () => {
    const { client } = build(() => json({ error: "", message: "", response: { nope: true } }));
    const err = await client.getModelList(credentials, 1n).catch((e: unknown) => e);
    if (!(err instanceof ShopeeApiError)) throw new Error("unreachable");
    expect(err.shopeeError).toBe("invalid_response");
  });

  it("counts calls", async () => {
    const { client } = build(() => new Response(fixture("model-list-803947690.json")));
    await client.getModelList(credentials, 1n);
    await client.getModelList(credentials, 2n);
    expect(client.callCount()).toBe(2);
  });
});
