import { describe, expect, it, vi } from 'vitest';

import type { CatalogueSyncSummary } from '@/server/services/catalogue-sync-service';

import { createCatalogueSyncJobHandler } from './catalogue-sync-controller';

const SECRET = 'test-job-secret-0123456789abcdef-xyz';
const URL = 'http://localhost:3000/api/jobs/shopee-sync';

const SUCCEEDED: CatalogueSyncSummary = {
  outcome: 'succeeded',
  runId: 'r1',
  itemsSeen: 9,
  itemsCreated: 9,
  itemsUpdated: 0,
  itemsDeactivated: 0,
  apiCalls: 20,
  warnings: [],
};

type RunSync = () => Promise<CatalogueSyncSummary>;

function setup(summary: CatalogueSyncSummary = SUCCEEDED) {
  const runSync = vi.fn<RunSync>(async () => summary);
  const handler = createCatalogueSyncJobHandler({ jobSecret: SECRET, runSync });
  return {
    runSync,
    call: (authorization?: string) =>
      handler(
        new Request(URL, {
          method: 'POST',
          headers: authorization === undefined ? {} : { Authorization: authorization },
        }),
      ),
  };
}

describe('createCatalogueSyncJobHandler', () => {
  it('refuses a missing secret', async () => {
    const { runSync, call } = setup();
    const response = await call();

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: { code: 'auth.unauthorized', messageKey: 'error.auth.unauthorized' },
    });
    expect(runSync).not.toHaveBeenCalled();
  });

  it('refuses a wrong secret of the same length', async () => {
    const { runSync, call } = setup();
    const wrong = 'x'.repeat(SECRET.length);
    const response = await call(`Bearer ${wrong}`);

    expect(response.status).toBe(401);
    expect(runSync).not.toHaveBeenCalled();
  });

  it('refuses a secret of a different length, and a different scheme', async () => {
    const { runSync, call } = setup();

    expect((await call(`Bearer ${SECRET}extra`)).status).toBe(401);
    expect((await call(`Bearer ${SECRET.slice(1)}`)).status).toBe(401);
    expect((await call(`Basic ${SECRET}`)).status).toBe(401);
    expect((await call(SECRET)).status).toBe(401);
    expect(runSync).not.toHaveBeenCalled();
  });

  it('runs and returns the summary', async () => {
    const { runSync, call } = setup();
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(SUCCEEDED);
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it('reports a skipped run as 200', async () => {
    const { call } = setup({ outcome: 'skipped' });
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: 'skipped' });
  });

  it('reports a failed run as 502 without detail', async () => {
    const { call } = setup({
      ...SUCCEEDED,
      outcome: 'failed',
      errorCode: 'error_auth',
      warnings: ['item 1: boom'],
    });
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: { code: 'catalogue_sync.failed', runId: 'r1' } });
  });
});
