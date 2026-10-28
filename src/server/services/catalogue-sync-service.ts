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
import {
  SALES_DATA_UNAVAILABLE,
  type CatalogueItemSnapshot,
  type CatalogueSource,
  type ListedItem,
} from './catalogue-snapshot';
import {
  ChannelNotConnectedError,
  ChannelTokenPersistenceError,
} from './channel-authorization-service';

/** A failure of the catalogue source (the vendor behind it is not named here). The code is safe to store. */
export class CatalogueSourceError extends Error {
  readonly code: string;

  /** `detail` must be as safe to store as the code: no token, key, signature or URL. */
  constructor(code: string, detail?: string) {
    super(`Catalogue source failed: ${code}${detail === undefined ? '' : ` — ${detail}`}`);
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

function isEmptySku(sku: string | null): boolean {
  return sku === null || sku.trim() === '';
}

/**
 * REQ-004: SKUs are stored as Shopee holds them and are not unique (spec 5.8), so empty and duplicate
 * SKUs among this run's upserted items are reported, never rejected. An item without models has no
 * model SKU of its own, so only the parent SKU is checked for it.
 */
function skuWarnings(snapshots: readonly CatalogueItemSnapshot[]): string[] {
  const parentCount = new Map<string, number>();
  const modelCount = new Map<string, number>();
  for (const snapshot of snapshots) {
    if (snapshot.parentSku !== null && !isEmptySku(snapshot.parentSku)) {
      parentCount.set(snapshot.parentSku, (parentCount.get(snapshot.parentSku) ?? 0) + 1);
    }
    for (const variant of snapshot.variants) {
      if (variant.externalModelId === null || variant.modelSku === null || isEmptySku(variant.modelSku)) continue;
      modelCount.set(variant.modelSku, (modelCount.get(variant.modelSku) ?? 0) + 1);
    }
  }

  const parent: string[] = [];
  const model: string[] = [];
  for (const snapshot of snapshots) {
    const item = `item ${snapshot.externalItemId}`;
    if (isEmptySku(snapshot.parentSku)) parent.push(`${item}: empty_parent_sku`);
    else if ((parentCount.get(snapshot.parentSku ?? '') ?? 0) > 1) parent.push(`${item}: duplicate_parent_sku`);
    for (const variant of snapshot.variants) {
      if (variant.externalModelId === null) continue;
      const where = `${item} model ${variant.externalModelId}`;
      if (isEmptySku(variant.modelSku)) model.push(`${where}: empty_model_sku`);
      else if ((modelCount.get(variant.modelSku ?? '') ?? 0) > 1) model.push(`${where}: duplicate_model_sku`);
    }
  }
  return [...parent, ...model];
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

    const knownIds = new Set(known.map((item) => item.externalItemId));
    const listedIds = new Set(listed.map((item) => item.externalItemId));
    // A failed item that was not known before would never be listed again once the window advances.
    let newItemFailures = 0;
    const countFailure = (externalItemId: bigint): void => {
      if (!knownIds.has(externalItemId)) newItemFailures += 1;
    };

    for (const failure of fetched.failures) {
      warnings.push(`item ${failure.externalItemId}: ${failure.reason}`);
      if (failure.reason !== SALES_DATA_UNAVAILABLE) countFailure(failure.externalItemId);
    }
    // Only an item that was not listed this run can be not-found; a listed one the source did not
    // return is a failure for that item.
    const notFound: bigint[] = [];
    for (const externalItemId of fetched.notFound) {
      if (listedIds.has(externalItemId)) {
        warnings.push(`item ${externalItemId}: not_returned`);
        countFailure(externalItemId);
      } else {
        notFound.push(externalItemId);
      }
    }
    const upserted: CatalogueItemSnapshot[] = [];
    for (const snapshot of fetched.snapshots) {
      try {
        const result = await catalogue.upsertCatalogueItem(snapshot, windowTo);
        if (result === 'created') counts.itemsCreated += 1;
        else counts.itemsUpdated += 1;
        upserted.push(snapshot);
      } catch (error) {
        warnings.push(`item ${snapshot.externalItemId}: ${messageOf(error)}`);
        countFailure(snapshot.externalItemId);
      }
    }
    warnings.push(...skuWarnings(upserted));
    counts.itemsDeactivated = await catalogue.markItemsNotFound(notFound, windowTo);

    const apiCalls = source.apiCallCount();
    if (newItemFailures > 0) {
      // Committed upserts stay; a failed outcome keeps the window where it was, so the items are retried.
      const errorCode = 'item_failures';
      await syncRuns.finishSyncRun(runId, {
        outcome: 'failed',
        finishedAt: deps.now(),
        ...counts,
        apiCalls,
        warnings,
        errorCode,
        errorDetail: `${newItemFailures} new item(s) failed`,
      });
      return { outcome: 'failed', runId, ...counts, apiCalls, warnings, errorCode };
    }
    await syncRuns.finishSyncRun(runId, {
      outcome: 'succeeded',
      finishedAt: deps.now(),
      ...counts,
      apiCalls,
      warnings,
    });
    return { outcome: 'succeeded', runId, ...counts, apiCalls, warnings };
  } catch (error) {
    // Every path after startSyncRun ends in a finish attempt. A stale 'running' row never blocks a new
    // run (the advisory lock does that), but it must not be left silently if it can be avoided.
    const errorCode = errorCodeOf(error);
    let apiCalls = 0;
    try {
      apiCalls = source.apiCallCount();
    } catch {
      // keep 0
    }
    const failed = { outcome: 'failed' as const, finishedAt: deps.now(), errorCode, errorDetail: messageOf(error) };
    try {
      await syncRuns.finishSyncRun(runId, { ...failed, ...counts, apiCalls, warnings });
    } catch {
      try {
        await syncRuns.finishSyncRun(runId, {
          ...failed,
          itemsSeen: 0,
          itemsCreated: 0,
          itemsUpdated: 0,
          itemsDeactivated: 0,
          apiCalls: 0,
          warnings: [],
        });
      } catch {
        throw error;
      }
    }
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
