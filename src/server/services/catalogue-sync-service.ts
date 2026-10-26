import type {
  listKnownItems,
  markItemsNotFound,
  upsertCatalogueItem,
} from '@/server/repositories/catalogue-repository';
import type {
  findLastSucceededSyncRun,
  finishSyncRun,
  recordSkippedSyncRun,
  startSyncRun,
} from '@/server/repositories/sync-run-repository';
import type { CatalogueSource, ListedItem } from './catalogue-snapshot';
import {
  ChannelNotConnectedError,
  ChannelTokenPersistenceError,
} from './channel-authorization-service';

/** A failure of the catalogue source (the vendor behind it is not named here). The code is safe to store. */
export class CatalogueSourceError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Catalogue source failed: ${code}`);
    this.name = 'CatalogueSourceError';
    this.code = code;
  }
}

export type CatalogueSyncSummary =
  | { outcome: 'skipped' }
  | {
      outcome: 'succeeded' | 'failed';
      runId: string;
      itemsSeen: number;
      itemsCreated: number;
      itemsUpdated: number;
      itemsDeactivated: number;
      apiCalls: number;
      warnings: string[];
      errorCode?: string;
    };

export type CatalogueSyncDeps = {
  source: CatalogueSource;
  catalogue: {
    upsertCatalogueItem: typeof upsertCatalogueItem;
    listKnownItems: typeof listKnownItems;
    markItemsNotFound: typeof markItemsNotFound;
  };
  syncRuns: {
    startSyncRun: typeof startSyncRun;
    finishSyncRun: typeof finishSyncRun;
    recordSkippedSyncRun: typeof recordSkippedSyncRun;
    findLastSucceededSyncRun: typeof findLastSucceededSyncRun;
  };
  lock: <T>(task: () => Promise<T>) => Promise<{ acquired: true; value: T } | { acquired: false }>;
  now: () => Date;
};

const WINDOW_OVERLAP_MS = 10 * 60 * 1000;

function errorCodeOf(error: unknown): string {
  if (error instanceof CatalogueSourceError) return error.code;
  if (error instanceof ChannelNotConnectedError) return 'channel_not_connected';
  if (error instanceof ChannelTokenPersistenceError) return 'token_persistence_failed';
  return 'unexpected';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/** Listed items win over known ones (status, kit flag); the rest of the known set is the stock sweep. */
function mergeItems(listed: readonly ListedItem[], known: readonly ListedItem[]): ListedItem[] {
  const byId = new Map<bigint, ListedItem>();
  for (const item of known) byId.set(item.externalItemId, item);
  for (const item of listed) byId.set(item.externalItemId, item);
  return [...byId.values()];
}

async function execute(deps: CatalogueSyncDeps): Promise<Exclude<CatalogueSyncSummary, { outcome: 'skipped' }>> {
  const { source, catalogue, syncRuns } = deps;
  const windowTo = deps.now();
  const last = await syncRuns.findLastSucceededSyncRun();
  const windowFrom = last === null ? null : new Date(last.windowTo.getTime() - WINDOW_OVERLAP_MS);
  const runId = await syncRuns.startSyncRun({ windowFrom, windowTo, startedAt: windowTo });

  const counts = { itemsSeen: 0, itemsCreated: 0, itemsUpdated: 0, itemsDeactivated: 0 };
  const warnings: string[] = [];

  try {
    const listed = await source.listItems(windowFrom === null ? null : { from: windowFrom, to: windowTo });
    const known = await catalogue.listKnownItems();
    const items = mergeItems(listed, known);
    const fetched = await source.fetchItems(items);
    counts.itemsSeen = items.length;

    for (const failure of fetched.failures) {
      warnings.push(`item ${failure.externalItemId}: ${failure.reason}`);
    }
    for (const snapshot of fetched.snapshots) {
      try {
        const result = await catalogue.upsertCatalogueItem(snapshot, windowTo);
        if (result === 'created') counts.itemsCreated += 1;
        else counts.itemsUpdated += 1;
      } catch (error) {
        warnings.push(`item ${snapshot.externalItemId}: ${messageOf(error)}`);
      }
    }
    counts.itemsDeactivated = await catalogue.markItemsNotFound(fetched.notFound, windowTo);

    const apiCalls = source.apiCallCount();
    await syncRuns.finishSyncRun(runId, {
      outcome: 'succeeded',
      finishedAt: deps.now(),
      ...counts,
      apiCalls,
      warnings,
    });
    return { outcome: 'succeeded', runId, ...counts, apiCalls, warnings };
  } catch (error) {
    const errorCode = errorCodeOf(error);
    const apiCalls = source.apiCallCount();
    await syncRuns.finishSyncRun(runId, {
      outcome: 'failed',
      finishedAt: deps.now(),
      ...counts,
      apiCalls,
      warnings,
      errorCode,
      errorDetail: messageOf(error),
    });
    return { outcome: 'failed', runId, ...counts, apiCalls, warnings, errorCode };
  }
}

/** One catalogue sync run: window, stock sweep, per-item upserts. Never deletes on a source failure. */
export async function runCatalogueSync(deps: CatalogueSyncDeps): Promise<CatalogueSyncSummary> {
  const result = await deps.lock(() => execute(deps));
  if (!result.acquired) {
    await deps.syncRuns.recordSkippedSyncRun(deps.now());
    return { outcome: 'skipped' };
  }
  return result.value;
}
