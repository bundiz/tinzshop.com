import { describe, expect, it } from "vitest";
import { signPublicRequest, signShopRequest } from "./sign";

describe("shopee signing", () => {
  it("signs a public request", () => {
    expect(
      signPublicRequest({
        partnerKey: "test-partner-key",
        partnerId: 1000001,
        path: "/api/v2/auth/token/get",
        timestamp: 1700000000,
      }),
    ).toBe("6aab77ee2280e403a38937412ca70e35114f12914ecb2c697ca10a6040598254");
  });

  it("signs a shop request", () => {
    expect(
      signShopRequest({
        partnerKey: "test-partner-key",
        partnerId: 1000001,
        path: "/api/v2/product/get_item_list",
        timestamp: 1700000000,
        accessToken: "test-access-token",
        shopId: 227679200n,
      }),
    ).toBe("e1e83b8cba981a89a0708d4684ab92e756b70e4efee746b95f495f58e79c7160");
  });
});
