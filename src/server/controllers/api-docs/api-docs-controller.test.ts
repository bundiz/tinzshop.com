import { describe, expect, it, vi } from 'vitest';

import { createApiDocsHandlers } from './api-docs-controller';

function setup(isProduction: boolean) {
  const readFile = vi.fn(async (path: string) => `contents of ${path}`);
  const handlers = createApiDocsHandlers({
    isProduction,
    readFile,
    specPath: '/repo/docs/openapi.yaml',
    assetDir: '/repo/node_modules/swagger-ui-dist',
  });
  return { readFile, handlers };
}

describe('createApiDocsHandlers', () => {
  it('answers 404 for the page, the spec and every asset in production without reading a file', async () => {
    const { readFile, handlers } = setup(true);

    expect((await handlers.page()).status).toBe(404);
    expect((await handlers.spec()).status).toBe(404);
    expect((await handlers.asset('swagger-ui-bundle.js')).status).toBe(404);
    expect(readFile).not.toHaveBeenCalled();
  });

  it('serves a Swagger UI page that loads the local spec and assets', async () => {
    const { handlers } = setup(false);
    const response = await handlers.page();
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(html).toContain('/api/docs/openapi');
    expect(html).toContain('/api/docs/assets/swagger-ui-bundle.js');
    expect(html).toContain('/api/docs/assets/swagger-ui.css');
  });

  it('serves docs/openapi.yaml as YAML', async () => {
    const { readFile, handlers } = setup(false);
    const response = await handlers.spec();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('yaml');
    expect(await response.text()).toBe('contents of /repo/docs/openapi.yaml');
    expect(readFile).toHaveBeenCalledWith('/repo/docs/openapi.yaml');
  });

  it('serves an allow-listed asset with its content type', async () => {
    const { handlers } = setup(false);
    const js = await handlers.asset('swagger-ui-bundle.js');
    const css = await handlers.asset('swagger-ui.css');

    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('javascript');
    expect(await js.text()).toBe('contents of /repo/node_modules/swagger-ui-dist/swagger-ui-bundle.js');
    expect(css.headers.get('content-type')).toContain('text/css');
  });

  it.each(['../package.json', 'index.html', 'swagger-ui-bundle.js.map', ''])(
    'answers 404 for the non-allow-listed asset %j without reading a file',
    async (name) => {
      const { readFile, handlers } = setup(false);

      expect((await handlers.asset(name)).status).toBe(404);
      expect(readFile).not.toHaveBeenCalled();
    },
  );
});
