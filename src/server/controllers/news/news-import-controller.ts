import { isJobAuthorized } from '@/server/controllers/shared/job-auth';

import type { NewsImportSummary } from '@/server/services/news/news-import-service';

// A job response is never cacheable.
const NO_STORE = { 'Cache-Control': 'no-store' };

/** `?full`: absent is a normal run, exactly `1` the full re-import (D-140); anything else, repeated included, is null. */
function parseFull(params: URLSearchParams): boolean | null {
  const values = params.getAll('full');
  if (values.length === 0) return false;
  return values.length === 1 && values[0] === '1' ? true : null;
}

/**
 * `POST /api/jobs/news-import` (plan 012). Order: the secret (401), then `?full` (400), then the source
 * setting (503), then the run. Both settings are read per request and only when needed, so an
 * unauthenticated caller learns nothing about configuration. `sourceUrl` is null when
 * `NEWS_IMPORT_SOURCE_URL` is unset. `?full=1` runs the full re-import (D-140).
 */
export function createNewsImportJobHandler(deps: {
  jobSecret: () => string;
  sourceUrl: () => string | null;
  runImport: (sourceUrl: string, options: { full: boolean }) => Promise<NewsImportSummary>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!isJobAuthorized(request.headers.get('authorization'), deps.jobSecret())) {
      return Response.json(
        { error: { code: 'auth.unauthorized', messageKey: 'error.auth.unauthorized' } },
        { status: 401, headers: NO_STORE },
      );
    }

    const full = parseFull(new URL(request.url).searchParams);
    if (full === null) {
      return Response.json({ error: { code: 'news_import.invalid_full' } }, { status: 400, headers: NO_STORE });
    }

    const sourceUrl = deps.sourceUrl();
    if (sourceUrl === null) {
      return Response.json({ error: { code: 'news_import.not_configured' } }, { status: 503, headers: NO_STORE });
    }

    const summary = await deps.runImport(sourceUrl, { full });

    if (summary.outcome === 'failed') {
      // The reason is a fixed code; posts saved before the failure stay, and a re-run continues.
      const { outcome: _outcome, errorCode, ...counts } = summary;
      return Response.json(
        { error: { code: 'news_import.failed', reason: errorCode, summary: counts } },
        { status: 502, headers: NO_STORE },
      );
    }

    return Response.json(summary, { headers: NO_STORE });
  };
}
