import { describe, expect, it, vi } from 'vitest';

import { createCatalogueActivationJobHandler } from './catalogue-activation-controller';

const SECRET = 'test-job-secret-0123456789abcdef-xyz';
const URL = 'http://localhost:3000/api/jobs/catalogue-activate';

function setup(isProduction = false) {
  const activate = vi.fn<() => Promise<number>>(async () => 3);
  const handler = createCatalogueActivationJobHandler({ isProduction, jobSecret: () => SECRET, activate });
  return {
    activate,
    call: (authorization?: string) =>
      handler(
        new Request(URL, {
          method: 'POST',
          headers: authorization === undefined ? {} : { Authorization: authorization },
        }),
      ),
  };
}

describe('createCatalogueActivationJobHandler', () => {
  it('answers 404 in production, even with the right secret, without activating', async () => {
    const { activate, call } = setup(true);
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(activate).not.toHaveBeenCalled();
  });

  it('refuses a missing secret', async () => {
    const { activate, call } = setup();
    const response = await call();

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: { code: 'auth.unauthorized', messageKey: 'error.auth.unauthorized' },
    });
    expect(activate).not.toHaveBeenCalled();
  });

  it('refuses a wrong secret of the same length and of a different length', async () => {
    const { activate, call } = setup();

    expect((await call(`Bearer ${'x'.repeat(SECRET.length)}`)).status).toBe(401);
    expect((await call('Bearer short')).status).toBe(401);
    expect(activate).not.toHaveBeenCalled();
  });

  it('activates and answers the count', async () => {
    const { activate, call } = setup();
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ activated: 3 });
    expect(activate).toHaveBeenCalledOnce();
  });
});
