import { createShopeeClient, type ShopeeClient } from '@/server/adapters/shopee/client';
import { createShopeeTokenIssuer } from '@/server/adapters/shopee/token-issuer';
import { getServerConfig } from '@/server/config';
import {
  findChannelAuthorization,
  saveChannelAuthorization,
} from '@/server/repositories/channel-authorization-repository';
import { createChannelAuthorizationService } from '@/server/services/channel-authorization-service';

// Built on first use, never at import, so `next build` needs no environment.
let shopeeClient: ShopeeClient | undefined;
let authorizationService: ReturnType<typeof createChannelAuthorizationService> | undefined;

export function getShopeeClient(): ShopeeClient {
  if (shopeeClient === undefined) {
    const { shopee } = getServerConfig();
    shopeeClient = createShopeeClient({
      baseUrl: shopee.apiBaseUrl,
      partnerId: shopee.partnerId,
      partnerKey: shopee.partnerKey,
    });
  }
  return shopeeClient;
}

export function getChannelAuthorizationService(): ReturnType<
  typeof createChannelAuthorizationService
> {
  if (authorizationService === undefined) {
    authorizationService = createChannelAuthorizationService({
      issuer: createShopeeTokenIssuer(getShopeeClient()),
      repository: { find: findChannelAuthorization, save: saveChannelAuthorization },
      encryptionKey: getServerConfig().channelTokenEncryptionKey,
      now: () => new Date(),
    });
  }
  return authorizationService;
}
