import { isJobAuthorized } from '@/server/controllers/shared/job-auth';

import type { NewsImportSummary } from '@/server/services/news/news-import-service';

// A job response is never cacheable.
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * `POST /api/jobs/news-import` (plan 012). Order: the secret (401), then the source setting (503),
 * then the run. Both settings are read per request and only when needed, so an unauthenticated
 * caller learns nothing about configuration. `sourceUrl` is null when `NEWS_IMPORT_SOURCE_URL` is unset.
 */
export function createNewsImportJobHandler(deps: {
  jobSecret: () => string;
  sourceUrl: () => string | null;
  runImport: (sourceUrl: string) => Promise<NewsImportSummary>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!isJobAuthorized(request.headers.get('authorization'), deps.jobSecret())) {
      return Response.json(
        { error: { code: 'auth.unauthorized', messageKey: 'error.auth.unauthorized' } },
        { status: 401, headers: NO_STORE },
      );
    }

    const sourceUrl = deps.sourceUrl();
    if (sourceUrl === null) {
      return Response.json({ error: { code: 'news_import.not_configured' } }, { status: 503, headers: NO_STORE });
    }

    const summary = await deps.runImport(sourceUrl);

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
