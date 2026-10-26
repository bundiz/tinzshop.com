import { beforeEach, describe, expect, it } from 'vitest';

import {
  listKnownItems,
  markItemsNotFound,
  upsertCatalogueItem,
} from '@/server/repositories/catalogue-repository';
import { CATALOGUE_SYNC_LOCK_KEY, tryWithAdvisoryLock } from '@/server/repositories/advisory-lock';
import { getPrisma } from '@/server/repositories/prisma';
import {
  findLastSucceededSyncRun,
  finishSyncRun,
  recordSkippedSyncRun,
  startSyncRun,
} from '@/server/repositories/sync-run-repository';
import { ChannelNotConnectedError } from '@/server/services/channel-authorization-service';
import type { CatalogueItemSnapshot, CatalogueSource, ListedItem } from '@/server/services/catalogue-snapshot';
import {
  CatalogueSourceError,
  runCatalogueSync,
  type CatalogueSyncSummary,
} from '@/server/services/catalogue-sync-service';
import { resetDatabase } from './setup/database';
import { noModelSnapshot, twoTierSnapshot } from './fixtures/snapshots';

const T1 = new Date('2026-10-26T01:00:00.000Z');
const T2 = new Date('2026-10-26T02:00:00.000Z');

beforeEach(async () => {
  await resetDatabase();
});

type FakeSource = CatalogueSource & {
  listWindows: ({ from: Date; to: Date } | null)[];
  fetched: bigint[][];
};

function fakeSource(options: {
  listed: () => ListedItem[] | Error;
  snapshots?: CatalogueItemSnapshot[];
  notFound?: bigint[];
  failures?: { externalItemId: bigint; reason: string }[];
}): FakeSource {
  const listWindows: FakeSource['listWindows'] = [];
  const fetched: bigint[][] = [];
  return {
    listWindows,
    fetched,
    listItems: async (window) => {
      listWindows.push(window);
      const result = options.listed();
      if (result instanceof Error) throw result;
      return result;
    },
    fetchItems: async (items) => {
      fetched.push(items.map((item) => item.externalItemId));
      return {
        snapshots: options.snapshots ?? [],
        notFound: options.notFound ?? [],
        failures: options.failures ?? [],
      };
    },
    apiCallCount: () => 7,
  };
}

function listedOf(snapshot: CatalogueItemSnapshot): ListedItem {
  return { externalItemId: snapshot.externalItemId, externalStatus: snapshot.externalStatus, isKit: snapshot.isKit };
}

function run(source: CatalogueSource, now: Date, lock = tryWithAdvisoryLock): Promise<CatalogueSyncSummary> {
  return runCatalogueSync({
    source,
    catalogue: { upsertCatalogueItem, listKnownItems, markItemsNotFound },
    syncRuns: { startSyncRun, finishSyncRun, recordSkippedSyncRun, findLastSucceededSyncRun },
    lock: (task) => lock(CATALOGUE_SYNC_LOCK_KEY, task),
    now: () => now,
  });
}

describe('runCatalogueSync', () => {
  it('first run asks for everything and creates products', async () => {
    const snapshots = [twoTierSnapshot(), noModelSnapshot()];
    const source = fakeSource({ listed: () => snapshots.map(listedOf), snapshots });
    const summary = await run(source, T1);

    expect(source.listWindows).toEqual([null]);
    expect(summary).toMatchObject({
      outcome: 'succeeded',
      itemsSeen: 2,
      itemsCreated: 2,
      itemsUpdated: 0,
      itemsDeactivated: 0,
      apiCalls: 7,
      warnings: [],
    });
    expect(await getPrisma().product.count()).toBe(2);
    const row = await getPrisma().syncRun.findFirstOrThrow();
    expect(row.outcome).toBe('succeeded');
    expect(row.windowTo).toEqual(T1);
  });

  it('second run uses an overlapping window', async () => {
    const snapshots = [twoTierSnapshot()];
    await run(fakeSource({ listed: () => snapshots.map(listedOf), snapshots }), T1);
    const second = fakeSource({ listed: () => [], snapshots });
    await run(second, T2);
    expect(second.listWindows).toEqual([{ from: new Date(T1.getTime() - 10 * 60_000), to: T2 }]);
  });

  it('sweeps known items even when the window returns nothing', async () => {
    const snapshots = [twoTierSnapshot(), noModelSnapshot()];
    await run(fakeSource({ listed: () => snapshots.map(listedOf), snapshots }), T1);
    const second = fakeSource({ listed: () => [], snapshots });
    const summary = await run(second, T2);
    expect([...(second.fetched[0] ?? [])].sort()).toEqual([803947687n, 803947690n]);
    expect(summary).toMatchObject({ outcome: 'succeeded', itemsSeen: 2, itemsUpdated: 2, itemsCreated: 0 });
  });

  it('lets a listed item win over the known one when de-duplicating', async () => {
    const snapshots = [twoTierSnapshot()];
    await run(fakeSource({ listed: () => snapshots.map(listedOf), snapshots }), T1);
    let seen: readonly ListedItem[] = [];
    const second: CatalogueSource = {
      listItems: async () => [{ externalItemId: 803947690n, externalStatus: 'UNLIST', isKit: true }],
      fetchItems: async (items) => {
        seen = items;
        return { snapshots: [], notFound: [], failures: [] };
      },
      apiCallCount: () => 0,
    };
    await run(second, T2);
    expect(seen).toEqual([{ externalItemId: 803947690n, externalStatus: 'UNLIST', isKit: true }]);
  });

  it('records an item failure as a warning and keeps the rest', async () => {
    const snapshots = [twoTierSnapshot()];
    const source = fakeSource({
      listed: () => [...snapshots.map(listedOf), { externalItemId: 5n, externalStatus: 'NORMAL', isKit: false }],
      snapshots,
      failures: [{ externalItemId: 5n, reason: 'error_server' }],
    });
    const summary = await run(source, T1);
    expect(summary).toMatchObject({ outcome: 'succeeded', itemsCreated: 1, itemsSeen: 2 });
    if (summary.outcome === 'skipped') throw new Error('unexpected');
    expect(summary.warnings).toEqual(['item 5: error_server']);
    expect((await getPrisma().syncRun.findFirstOrThrow()).warnings).toEqual(['item 5: error_server']);
  });

  it('turns an upsert error into a warning and keeps the other items', async () => {
    const bad = twoTierSnapshot();
    const good = noModelSnapshot();
    const source = fakeSource({ listed: () => [bad, good].map(listedOf), snapshots: [bad, good] });
    const summary = await runCatalogueSync({
      source,
      catalogue: {
        upsertCatalogueItem: async (snapshot, at) => {
          if (snapshot.externalItemId === bad.externalItemId) throw new Error('boom');
          return upsertCatalogueItem(snapshot, at);
        },
        listKnownItems,
        markItemsNotFound,
      },
      syncRuns: { startSyncRun, finishSyncRun, recordSkippedSyncRun, findLastSucceededSyncRun },
      lock: (task) => tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, task),
      now: () => T1,
    });
    if (summary.outcome === 'skipped') throw new Error('unexpected');
    expect(summary.outcome).toBe('succeeded');
    expect(summary.itemsCreated).toBe(1);
    expect(summary.warnings).toEqual(['item 803947690: boom']);
  });

  it('marks not-found items and counts them as deactivated', async () => {
    const snapshots = [twoTierSnapshot()];
    await run(fakeSource({ listed: () => snapshots.map(listedOf), snapshots }), T1);
    const summary = await run(fakeSource({ listed: () => [], notFound: [803947690n] }), T2);
    expect(summary).toMatchObject({ outcome: 'succeeded', itemsDeactivated: 1 });
    expect(await listKnownItems()).toEqual([]);
  });

  it('a failed listing leaves existing products untouched', async () => {
    const snapshots = [twoTierSnapshot()];
    await run(fakeSource({ listed: () => snapshots.map(listedOf), snapshots }), T1);
    const before = await getPrisma().channelItem.findMany({ orderBy: { id: 'asc' } });

    const summary = await run(fakeSource({ listed: () => new CatalogueSourceError('error_auth') }), T2);

    expect(summary).toMatchObject({ outcome: 'failed', errorCode: 'error_auth' });
    expect(await getPrisma().channelItem.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    const failed = await getPrisma().syncRun.findFirstOrThrow({ where: { outcome: 'failed' } });
    expect(failed.errorCode).toBe('error_auth');
    expect(failed.errorDetail).toBe('Catalogue source failed: error_auth');
  });

  it('a stuck listing fails the run and the next window starts from the last succeeded run', async () => {
    const snapshots = [twoTierSnapshot()];
    await run(fakeSource({ listed: () => snapshots.map(listedOf), snapshots }), T1);
    const failed = await run(fakeSource({ listed: () => new CatalogueSourceError('listing_stuck') }), T2);
    expect(failed).toMatchObject({ outcome: 'failed', errorCode: 'listing_stuck' });
    const T3 = new Date('2026-10-26T03:00:00.000Z');
    const third = fakeSource({ listed: () => [], snapshots });
    await run(third, T3);
    expect(third.listWindows).toEqual([{ from: new Date(T1.getTime() - 10 * 60_000), to: T3 }]);
  });

  it('ends the run failed when finishing it as succeeded throws once', async () => {
    const snapshots = [twoTierSnapshot()];
    let calls = 0;
    const summary = await runCatalogueSync({
      source: fakeSource({ listed: () => snapshots.map(listedOf), snapshots }),
      catalogue: { upsertCatalogueItem, listKnownItems, markItemsNotFound },
      syncRuns: {
        startSyncRun,
        finishSyncRun: async (id, result) => {
          calls += 1;
          if (calls === 1) throw new Error('db hiccup');
          return finishSyncRun(id, result);
        },
        recordSkippedSyncRun,
        findLastSucceededSyncRun,
      },
      lock: (task) => tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, task),
      now: () => T1,
    });
    expect(summary).toMatchObject({ outcome: 'failed', errorCode: 'unexpected' });
    const rows = await getPrisma().syncRun.findMany();
    expect(rows.map((r) => r.outcome)).toEqual(['failed']);
    expect(rows[0]?.errorDetail).toBe('db hiccup');
  });

  it('retries a failed-finish once with a minimal result, then rethrows the original error', async () => {
    let calls = 0;
    const attempt = runCatalogueSync({
      source: fakeSource({ listed: () => new Error('original') }),
      catalogue: { upsertCatalogueItem, listKnownItems, markItemsNotFound },
      syncRuns: {
        startSyncRun,
        finishSyncRun: async () => {
          calls += 1;
          throw new Error('finish down');
        },
        recordSkippedSyncRun,
        findLastSucceededSyncRun,
      },
      lock: (task) => tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, task),
      now: () => T1,
    });
    await expect(attempt).rejects.toThrow('original');
    expect(calls).toBe(2);
    // A stale running row never blocks the next run: only the advisory lock does.
    const next = await run(fakeSource({ listed: () => [] }), T2);
    expect(next.outcome).toBe('succeeded');
  });

  it('maps a thrown ChannelNotConnectedError to channel_not_connected', async () => {
    const summary = await run(fakeSource({ listed: () => new ChannelNotConnectedError() }), T1);
    expect(summary).toMatchObject({ outcome: 'failed', errorCode: 'channel_not_connected' });
  });

  it('maps an unknown error to unexpected', async () => {
    const summary = await run(fakeSource({ listed: () => new Error('weird') }), T1);
    expect(summary).toMatchObject({ outcome: 'failed', errorCode: 'unexpected' });
    expect((await getPrisma().syncRun.findFirstOrThrow()).errorDetail).toBe('weird');
  });

  it('does not touch the source before the lock is held, and skips when it is not', async () => {
    const source = fakeSource({ listed: () => [] });
    const summary = await runCatalogueSync({
      source,
      catalogue: { upsertCatalogueItem, listKnownItems, markItemsNotFound },
      syncRuns: { startSyncRun, finishSyncRun, recordSkippedSyncRun, findLastSucceededSyncRun },
      lock: async () => ({ acquired: false }),
      now: () => T1,
    });
    expect(summary).toEqual({ outcome: 'skipped' });
    expect(source.listWindows).toEqual([]);
    const rows = await getPrisma().syncRun.findMany();
    expect(rows.map((r) => r.outcome)).toEqual(['skipped']);
  });
});
