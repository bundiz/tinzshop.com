import { timingSafeEqual } from 'node:crypto';

import type { CatalogueSyncSummary } from '@/server/services/catalogue-sync-service';

// A job response is never cacheable.
const NO_STORE = { 'Cache-Control': 'no-store' };

function isAuthorized(header: string | null, jobSecret: string): boolean {
  if (header === null) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${jobSecret}`);
  // timingSafeEqual throws on unequal lengths; a length mismatch is simply a refusal.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function createCatalogueSyncJobHandler(deps: {
  jobSecret: string;
  runSync: () => Promise<CatalogueSyncSummary>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!isAuthorized(request.headers.get('authorization'), deps.jobSecret)) {
      return Response.json(
        { error: { code: 'auth.unauthorized', messageKey: 'error.auth.unauthorized' } },
        { status: 401, headers: NO_STORE },
      );
    }

    const summary = await deps.runSync();

    if (summary.outcome === 'failed') {
      // The cause is in the sync_run row; the caller only needs to know which run failed.
      return Response.json(
        { error: { code: 'catalogue_sync.failed', runId: summary.runId } },
        { status: 502, headers: NO_STORE },
      );
    }

    return Response.json(summary, { headers: NO_STORE });
  };
}
