import { describe, expect, it } from 'vitest';

import { CATALOGUE_SYNC_LOCK_KEY, tryWithAdvisoryLock } from '@/server/repositories/advisory-lock';

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
