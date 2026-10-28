import { getPrisma } from '@/server/repositories/shared/prisma';

const CHANNEL = 'shopee';

export type SyncRunResult = {
  outcome: 'succeeded' | 'failed';
  finishedAt: Date;
  itemsSeen: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeactivated: number;
  apiCalls: number;
  warnings: readonly string[];
  errorCode?: string;
  errorDetail?: string;
};

export async function startSyncRun(input: {
  windowFrom: Date | null;
  windowTo: Date;
  startedAt: Date;
}): Promise<string> {
  const run = await getPrisma().syncRun.create({
    data: {
      channel: CHANNEL,
      startedAt: input.startedAt,
      outcome: 'running',
      windowFrom: input.windowFrom,
      windowTo: input.windowTo,
    },
    select: { id: true },
  });
  return run.id;
}

export async function finishSyncRun(id: string, result: SyncRunResult): Promise<void> {
  await getPrisma().syncRun.update({
    where: { id },
    data: {
      outcome: result.outcome,
      finishedAt: result.finishedAt,
      itemsSeen: result.itemsSeen,
      itemsCreated: result.itemsCreated,
      itemsUpdated: result.itemsUpdated,
      itemsDeactivated: result.itemsDeactivated,
      apiCalls: result.apiCalls,
      warnings: [...result.warnings],
      errorCode: result.errorCode ?? null,
      errorDetail: result.errorDetail ?? null,
    },
  });
}

/** A run that did not start because another holder had the lock. */
export async function recordSkippedSyncRun(at: Date): Promise<void> {
  await getPrisma().syncRun.create({
    data: { channel: CHANNEL, startedAt: at, finishedAt: at, outcome: 'skipped' },
  });
}

/** The succeeded run with the latest window end; the next incremental window starts there. */
export async function findLastSucceededSyncRun(): Promise<{ windowTo: Date } | null> {
  const run = await getPrisma().syncRun.findFirst({
    where: { channel: CHANNEL, outcome: 'succeeded', windowTo: { not: null } },
    orderBy: { windowTo: 'desc' },
    select: { windowTo: true },
  });
  if (run === null || run.windowTo === null) return null;
  return { windowTo: run.windowTo };
}
