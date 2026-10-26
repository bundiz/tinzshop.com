import type { ShopeeClient } from '@/server/adapters/shopee/client';
import type { TokenIssuer } from '@/server/services/channel-authorization-service';

export function createShopeeTokenIssuer(client: ShopeeClient): TokenIssuer {
  return {
    exchangeCode: ({ code, externalShopId }) =>
      client.getAccessToken({ code, shopId: externalShopId }),
    refresh: ({ refreshToken, externalShopId }) =>
      client.refreshAccessToken({ refreshToken, shopId: externalShopId }),
  };
}
