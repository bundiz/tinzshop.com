import { decryptSecret, encryptSecret } from '@/lib/secret-box';
import type {
  findChannelAuthorization,
  saveChannelAuthorization,
  StoredChannelAuthorization,
} from '@/server/repositories/channel-authorization-repository';

export type IssuedTokens = { accessToken: string; refreshToken: string; expiresInSeconds: number };

export type TokenIssuer = {
  exchangeCode(input: { code: string; externalShopId: bigint }): Promise<IssuedTokens>;
  refresh(input: { refreshToken: string; externalShopId: bigint }): Promise<IssuedTokens>;
};

export class ChannelNotConnectedError extends Error {
  constructor() {
    super('No Shopee shop is connected');
    this.name = 'ChannelNotConnectedError';
  }
}

const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function createChannelAuthorizationService(deps: {
  issuer: TokenIssuer;
  repository: { find: typeof findChannelAuthorization; save: typeof saveChannelAuthorization };
  encryptionKey: Buffer;
  now: () => Date;
}): {
  connectShop(input: { code: string; externalShopId: bigint }): Promise<void>;
  getShopCredentials(): Promise<{ accessToken: string; externalShopId: bigint }>;
} {
  async function store(externalShopId: bigint, tokens: IssuedTokens): Promise<void> {
    const issuedAt = deps.now().getTime();
    const record: StoredChannelAuthorization = {
      channel: 'shopee',
      externalShopId,
      accessTokenCiphertext: encryptSecret(tokens.accessToken, deps.encryptionKey),
      refreshTokenCiphertext: encryptSecret(tokens.refreshToken, deps.encryptionKey),
      accessTokenExpiresAt: new Date(issuedAt + tokens.expiresInSeconds * 1000),
      refreshTokenExpiresAt: new Date(issuedAt + REFRESH_TOKEN_LIFETIME_MS),
      // Filled from v2.shop.get_shop_info expire_time in a follow-on plan.
      authorizationExpiresAt: null,
    };
    await deps.repository.save(record);
  }

  return {
    async connectShop({ code, externalShopId }) {
      const tokens = await deps.issuer.exchangeCode({ code, externalShopId });
      await store(externalShopId, tokens);
    },

    async getShopCredentials() {
      const stored = await deps.repository.find('shopee');
      if (stored === null) throw new ChannelNotConnectedError();

      const remainingMs = stored.accessTokenExpiresAt.getTime() - deps.now().getTime();
      if (remainingMs > REFRESH_MARGIN_MS) {
        return {
          accessToken: decryptSecret(stored.accessTokenCiphertext, deps.encryptionKey),
          externalShopId: stored.externalShopId,
        };
      }

      const tokens = await deps.issuer.refresh({
        refreshToken: decryptSecret(stored.refreshTokenCiphertext, deps.encryptionKey),
        externalShopId: stored.externalShopId,
      });
      await store(stored.externalShopId, tokens);
      return { accessToken: tokens.accessToken, externalShopId: stored.externalShopId };
    },
  };
}
