import { getPrisma } from '@/server/repositories/shared/prisma';

/**
 * Counts one hit for `key` in the window starting at `windowStart` and returns the new count. In the
 * same transaction it deletes counters whose window started before `sweepBefore`, because a key can
 * hold an IP address, which is personal data.
 */
export async function hitRateLimit(key: string, windowStart: Date, sweepBefore: Date): Promise<number> {
  return getPrisma().$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ count: number }[]>`
      INSERT INTO auth_rate_limit (key, window_start, count)
      VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT (key, window_start) DO UPDATE SET count = auth_rate_limit.count + 1
      RETURNING count`;
    await tx.$executeRaw`DELETE FROM auth_rate_limit WHERE window_start < ${sweepBefore}`;
    return Number(rows[0]?.count ?? 0);
  });
}
