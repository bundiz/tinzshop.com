import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

import { getDatabaseUrl } from '@/server/config';
import { CATALOGUE_SYNC_LOCK_KEY, tryWithAdvisoryLock } from '@/server/repositories/shared/advisory-lock';

describe('tryWithAdvisoryLock', () => {
  it('second holder is refused while the first holds the lock', async () => {
    const outer = await tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, async () => {
      const inner = await tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, async () => 'never');
      return inner;
    });
    expect(outer).toEqual({ acquired: true, value: { acquired: false } });

    const after = await tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, async () => 'ok');
    expect(after).toEqual({ acquired: true, value: 'ok' });
  });

  it('releases the lock when the task throws', async () => {
    await expect(
      tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const after = await tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, async () => 'ok');
    expect(after).toEqual({ acquired: true, value: 'ok' });
  });
});

describe('tryWithAdvisoryLock with a dead connection', () => {
  it('keeps the task value when the lock connection is terminated mid-task', async () => {
    const result = await tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, async () => {
      const admin = new Client({ connectionString: getDatabaseUrl() });
      await admin.connect();
      try {
        await admin.query(
          `SELECT pg_terminate_backend(pid) FROM pg_locks
           WHERE locktype = 'advisory' AND granted
             AND ((classid::bigint << 32) | objid::bigint) = $1::bigint`,
          [CATALOGUE_SYNC_LOCK_KEY.toString()],
        );
      } finally {
        await admin.end();
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      return 'still-here';
    });
    expect(result).toEqual({ acquired: true, value: 'still-here' });

    const after = await tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, async () => 'ok');
    expect(after).toEqual({ acquired: true, value: 'ok' });
  });
});
