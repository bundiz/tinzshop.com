import { getPrisma } from '@/server/repositories/shared/prisma';

export type StoredChannelAuthorization = {
  channel: 'shopee';
  externalShopId: bigint;
  accessTokenCiphertext: string;
  refreshTokenCiphertext: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  authorizationExpiresAt: Date | null;
};

/** The shop is single (spec §5.4): the one row, or the most recently updated if several exist. */
export async function findChannelAuthorization(
  channel: 'shopee',
): Promise<StoredChannelAuthorization | null> {
  const row = await getPrisma().channelAuthorization.findFirst({
    where: { channel },
    orderBy: { updatedAt: 'desc' },
  });
  if (row === null) return null;
  return {
    channel,
    externalShopId: row.externalShopId,
    accessTokenCiphertext: row.accessTokenCiphertext,
    refreshTokenCiphertext: row.refreshTokenCiphertext,
    accessTokenExpiresAt: row.accessTokenExpiresAt,
    refreshTokenExpiresAt: row.refreshTokenExpiresAt,
    authorizationExpiresAt: row.authorizationExpiresAt,
  };
}

export async function saveChannelAuthorization(record: StoredChannelAuthorization): Promise<void> {
  const values = {
    accessTokenCiphertext: record.accessTokenCiphertext,
    refreshTokenCiphertext: record.refreshTokenCiphertext,
    accessTokenExpiresAt: record.accessTokenExpiresAt,
    refreshTokenExpiresAt: record.refreshTokenExpiresAt,
    authorizationExpiresAt: record.authorizationExpiresAt,
  };
  await getPrisma().channelAuthorization.upsert({
    where: {
      channel_externalShopId: { channel: record.channel, externalShopId: record.externalShopId },
    },
    create: { channel: record.channel, externalShopId: record.externalShopId, ...values },
    update: values,
  });
}
