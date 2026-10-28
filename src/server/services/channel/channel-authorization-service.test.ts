import { describe, expect, it, vi } from 'vitest';

import { decryptSecret, encryptSecret } from '@/lib/secret-box';
import type { StoredChannelAuthorization } from '@/server/repositories/channel/channel-authorization-repository';

import {
  ChannelNotConnectedError,
  ChannelTokenPersistenceError,
  createChannelAuthorizationService,
  type IssuedTokens,
  type TokenIssuer,
} from './channel-authorization-service';

const KEY = Buffer.alloc(32, 9);
const NOW = new Date('2026-10-26T00:00:00Z');
const SHOP = 227679200n;

function minutesFromNow(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000);
}

function setup(stored: StoredChannelAuthorization | null, issued?: IssuedTokens) {
  const tokens: IssuedTokens = issued ?? {
    accessToken: 'acc-1',
    refreshToken: 'ref-1',
    expiresInSeconds: 14400,
  };
  const exchangeCode = vi.fn<TokenIssuer['exchangeCode']>().mockResolvedValue(tokens);
  const refresh = vi.fn<TokenIssuer['refresh']>().mockResolvedValue(tokens);
  const save = vi.fn<(record: StoredChannelAuthorization) => Promise<void>>().mockResolvedValue();
  const service = createChannelAuthorizationService({
    issuer: { exchangeCode, refresh },
    repository: { find: async () => stored, save },
    encryptionKey: KEY,
    now: () => NOW,
  });
  return { service, exchangeCode, refresh, save };
}

function storedWith(accessExpiresInMinutes: number): StoredChannelAuthorization {
  return {
    channel: 'shopee',
    externalShopId: SHOP,
    accessTokenCiphertext: encryptSecret('acc-old', KEY),
    refreshTokenCiphertext: encryptSecret('ref-old', KEY),
    accessTokenExpiresAt: minutesFromNow(accessExpiresInMinutes),
    refreshTokenExpiresAt: minutesFromNow(60 * 24 * 20),
    authorizationExpiresAt: null,
  };
}

describe('channel authorization service', () => {
  it('connectShop stores only encrypted tokens with correct expiry', async () => {
    const { service, exchangeCode, save } = setup(null);

    await service.connectShop({ code: 'code-1', externalShopId: SHOP });

    expect(exchangeCode).toHaveBeenCalledWith({ code: 'code-1', externalShopId: SHOP });
    const record = save.mock.calls[0]![0];
    expect(decryptSecret(record.accessTokenCiphertext, KEY)).toBe('acc-1');
    expect(decryptSecret(record.refreshTokenCiphertext, KEY)).toBe('ref-1');
    expect(record.accessTokenCiphertext).not.toContain('acc-1');
    expect(record.refreshTokenCiphertext).not.toContain('ref-1');
    expect(record.accessTokenExpiresAt).toEqual(new Date('2026-10-26T04:00:00Z'));
    expect(record.refreshTokenExpiresAt).toEqual(new Date('2026-11-25T00:00:00Z'));
    expect(record.authorizationExpiresAt).toBeNull();
    expect(record.externalShopId).toBe(SHOP);
    expect(record.channel).toBe('shopee');
  });

  it('returns the stored token while more than 5 minutes remain', async () => {
    const { service, refresh, save } = setup(storedWith(10));

    await expect(service.getShopCredentials()).resolves.toEqual({
      accessToken: 'acc-old',
      externalShopId: SHOP,
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('refreshes and saves the new pair when under 5 minutes remain', async () => {
    const { service, refresh, save } = setup(storedWith(4), {
      accessToken: 'acc-2',
      refreshToken: 'ref-2',
      expiresInSeconds: 14400,
    });

    const credentials = await service.getShopCredentials();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith({ refreshToken: 'ref-old', externalShopId: SHOP });
    expect(credentials).toEqual({ accessToken: 'acc-2', externalShopId: SHOP });
    const record = save.mock.calls[0]![0];
    expect(decryptSecret(record.accessTokenCiphertext, KEY)).toBe('acc-2');
    expect(decryptSecret(record.refreshTokenCiphertext, KEY)).toBe('ref-2');
  });

  it('throws ChannelNotConnectedError when no shop is connected', async () => {
    const { service } = setup(null);

    await expect(service.getShopCredentials()).rejects.toBeInstanceOf(ChannelNotConnectedError);
  });

  function setupWithFailingSave(failures: number) {
    const refresh = vi.fn<TokenIssuer['refresh']>().mockResolvedValue({
      accessToken: 'acc-2',
      refreshToken: 'ref-2',
      expiresInSeconds: 14400,
    });
    let calls = 0;
    const save = vi.fn<(record: StoredChannelAuthorization) => Promise<void>>(async () => {
      calls += 1;
      if (calls <= failures) throw new Error('connection lost');
    });
    const service = createChannelAuthorizationService({
      issuer: { exchangeCode: vi.fn(), refresh },
      repository: { find: async () => storedWith(4), save },
      encryptionKey: KEY,
      now: () => NOW,
    });
    return { service, save };
  }

  it('retries the save once so a refreshed single-use token pair is not lost', async () => {
    const { service, save } = setupWithFailingSave(1);

    await expect(service.getShopCredentials()).resolves.toEqual({
      accessToken: 'acc-2',
      externalShopId: SHOP,
    });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('throws ChannelTokenPersistenceError, without any token, when the retry also fails', async () => {
    const { service, save } = setupWithFailingSave(2);

    const error = await service.getShopCredentials().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ChannelTokenPersistenceError);
    const message = (error as Error).message;
    expect(message).toBe('New Shopee tokens could not be saved; the shop must be re-authorized.');
    expect(message).not.toContain('acc-2');
    expect(message).not.toContain('ref-2');
    expect(save).toHaveBeenCalledTimes(2);
  });
});
