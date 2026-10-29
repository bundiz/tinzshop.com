import { timingSafeEqual } from 'node:crypto';

import type { NewsImportSummary } from '@/server/services/news/news-import-service';

// A job response is never cacheable.
const NO_STORE = { 'Cache-Control': 'no-store' };

function isAuthorized(header: string | null, jobSecret: string): boolean {
  if (header === null) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${jobSecret}`);
  // timingSafeEqual throws on unequal lengths; a length mismatch is simply a refusal.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * `POST /api/jobs/news-import` (plan 012). The secret is checked before anything else, so an
 * unauthenticated caller learns nothing about configuration. `runImport` is null when
 * `NEWS_IMPORT_SOURCE_URL` is not set.
 */
export function createNewsImportJobHandler(deps: {
  jobSecret: () => string;
  runImport: (() => Promise<NewsImportSummary>) | null;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!isAuthorized(request.headers.get('authorization'), deps.jobSecret())) {
      return Response.json(
        { error: { code: 'auth.unauthorized', messageKey: 'error.auth.unauthorized' } },
        { status: 401, headers: NO_STORE },
      );
    }

    if (deps.runImport === null) {
      return Response.json({ error: { code: 'news_import.not_configured' } }, { status: 503, headers: NO_STORE });
    }

    const summary = await deps.runImport();

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
