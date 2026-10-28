import { join } from 'node:path';

// Development-only API docs (D-115): docs/openapi.yaml rendered by a pinned, locally served Swagger UI.
const NO_STORE = { 'Cache-Control': 'no-store' };

const ASSET_TYPES: Readonly<Record<string, string>> = {
  'swagger-ui-bundle.js': 'text/javascript; charset=utf-8',
  'swagger-ui.css': 'text/css; charset=utf-8',
};

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tinzshop API</title>
    <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger"></div>
    <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({ url: '/api/docs/openapi', dom_id: '#swagger' });
    </script>
  </body>
</html>
`;

function notFound(): Response {
  return new Response('Not Found', { status: 404, headers: NO_STORE });
}

export function createApiDocsHandlers(deps: {
  isProduction: boolean;
  readFile: (path: string) => Promise<string>;
  specPath: string;
  assetDir: string;
}): {
  page: () => Promise<Response>;
  spec: () => Promise<Response>;
  asset: (name: string) => Promise<Response>;
} {
  return {
    async page() {
      if (deps.isProduction) return notFound();
      return new Response(PAGE, { headers: { ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8' } });
    },

    async spec() {
      if (deps.isProduction) return notFound();
      const yaml = await deps.readFile(deps.specPath);
      return new Response(yaml, { headers: { ...NO_STORE, 'Content-Type': 'application/yaml; charset=utf-8' } });
    },

    async asset(name) {
      // Only allow-listed names are joined to a path, so no request can read another file.
      const contentType = Object.hasOwn(ASSET_TYPES, name) ? ASSET_TYPES[name] : undefined;
      if (deps.isProduction || contentType === undefined) return notFound();
      const body = await deps.readFile(join(deps.assetDir, name));
      return new Response(body, { headers: { ...NO_STORE, 'Content-Type': contentType } });
    },
  };
}
