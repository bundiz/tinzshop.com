import { Client } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDatabaseUrl } from '@/server/config';
import {
  findChannelAuthorization,
  saveChannelAuthorization,
  type StoredChannelAuthorization,
} from '@/server/repositories/channel/channel-authorization-repository';
import { resetDatabase } from '../setup/database';

let client: Client;

beforeEach(async () => {
  await resetDatabase();
  client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();
});

afterEach(async () => {
  await client.end();
});

function record(suffix: string, expiresAt: string): StoredChannelAuthorization {
  return {
    channel: 'shopee',
    externalShopId: 227679200n,
    accessTokenCiphertext: `sealed-access-${suffix}`,
    refreshTokenCiphertext: `sealed-refresh-${suffix}`,
    accessTokenExpiresAt: new Date(expiresAt),
    refreshTokenExpiresAt: new Date('2026-11-25T00:00:00Z'),
    authorizationExpiresAt: null,
  };
}

describe('channel authorization repository', () => {
  it('returns null when nothing is stored', async () => {
    await expect(findChannelAuthorization('shopee')).resolves.toBeNull();
  });

  it('saves and reads back one authorization per shop', async () => {
    await saveChannelAuthorization(record('one', '2026-10-26T04:00:00Z'));
    await saveChannelAuthorization(record('two', '2026-10-26T08:00:00Z'));

    const count = await client.query<{ count: string }>(
      'SELECT count(*) FROM channel_authorization',
    );
    expect(count.rows[0]!.count).toBe('1');
    await expect(findChannelAuthorization('shopee')).resolves.toEqual(
      record('two', '2026-10-26T08:00:00Z'),
    );
  });
});
