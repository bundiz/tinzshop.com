import { describe, expect, it, vi } from 'vitest';

import type { NewsImportSummary } from '@/server/services/news/news-import-service';

import { createNewsImportJobHandler } from './news-import-controller';

const SECRET = 'test-job-secret-0123456789abcdef-xyz';
const URL = 'http://localhost:3000/api/jobs/news-import';

const SUCCEEDED: NewsImportSummary = {
  outcome: 'succeeded',
  categories: 13,
  created: 540,
  updated: 0,
  unchanged: 0,
  failed: 0,
  failedPosts: [],
  removedEmbeds: 7,
};

const SOURCE_URL = 'https://old-site.test';

type RunImport = (sourceUrl: string) => Promise<NewsImportSummary>;

function setup(summary: NewsImportSummary = SUCCEEDED, sourceUrl: () => string | null = () => SOURCE_URL) {
  const runImport = vi.fn<RunImport>(async () => summary);
  const readSourceUrl = vi.fn(sourceUrl);
  const handler = createNewsImportJobHandler({ jobSecret: () => SECRET, sourceUrl: readSourceUrl, runImport });
  return {
    runImport,
    readSourceUrl,
    call: (authorization?: string) =>
      handler(
        new Request(URL, {
          method: 'POST',
          headers: authorization === undefined ? {} : { Authorization: authorization },
        }),
      ),
  };
}

describe('createNewsImportJobHandler', () => {
  it('answers 401 without the secret', async () => {
    const { runImport, call } = setup();
    const response = await call();

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: { code: 'auth.unauthorized', messageKey: 'error.auth.unauthorized' },
    });
    expect(runImport).not.toHaveBeenCalled();
  });

  it('answers 401 for a wrong secret, another length or another scheme', async () => {
    const { runImport, call } = setup();

    expect((await call(`Bearer ${'x'.repeat(SECRET.length)}`)).status).toBe(401);
    expect((await call(`Bearer ${SECRET}extra`)).status).toBe(401);
    expect((await call(`Basic ${SECRET}`)).status).toBe(401);
    expect(runImport).not.toHaveBeenCalled();
  });

  it('answers 200 with the summary', async () => {
    const { runImport, call } = setup();
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(SUCCEEDED);
    expect(runImport).toHaveBeenCalledWith(SOURCE_URL);
  });

  it('answers 200 skipped on a concurrent run', async () => {
    const { call } = setup({ outcome: 'skipped' });
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: 'skipped' });
  });

  it('answers 502 with the reason and the counts when the run failed', async () => {
    const failedPosts = [{ sourceId: '5492', reason: 'save_failed' }];
    const { call } = setup({ ...SUCCEEDED, outcome: 'failed', created: 100, failed: 1, failedPosts, errorCode: 'timeout' });
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: {
        code: 'news_import.failed',
        reason: 'timeout',
        summary: { categories: 13, created: 100, updated: 0, unchanged: 0, failed: 1, failedPosts, removedEmbeds: 7 },
      },
    });
  });

  it('answers 503 when the source is not configured, after the secret check', async () => {
    const unconfigured = setup(SUCCEEDED, () => null);

    expect((await unconfigured.call()).status).toBe(401);
    const response = await unconfigured.call(`Bearer ${SECRET}`);
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: { code: 'news_import.not_configured' } });
    expect(unconfigured.runImport).not.toHaveBeenCalled();
  });

  it('answers 401 for a wrong secret without reading the rest of the configuration', async () => {
    const { readSourceUrl, call } = setup(SUCCEEDED, () => {
      throw new Error('Invalid server configuration. NEWS_IMPORT_SOURCE_URL: must be an http or https URL');
    });

    expect((await call('Bearer wrong')).status).toBe(401);
    expect(readSourceUrl).not.toHaveBeenCalled();
  });
});
