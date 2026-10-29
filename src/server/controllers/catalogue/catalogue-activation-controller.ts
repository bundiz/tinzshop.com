import { timingSafeEqual } from 'node:crypto';

// A job response is never cacheable.
const NO_STORE = { 'Cache-Control': 'no-store' };

function isAuthorized(header: string | null, jobSecret: string): boolean {
  if (header === null) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${jobSecret}`);
  // timingSafeEqual throws on unequal lengths; a length mismatch is simply a refusal.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Development-only (D-117): the endpoint does not exist in production, so the 404 comes before auth. */
export function createCatalogueActivationJobHandler(deps: {
  isProduction: boolean;
  jobSecret: () => string;
  activate: () => Promise<number>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    if (deps.isProduction) {
      return new Response('Not Found', { status: 404, headers: NO_STORE });
    }
    if (!isAuthorized(request.headers.get('authorization'), deps.jobSecret())) {
      return Response.json(
        { error: { code: 'auth.unauthorized', messageKey: 'error.auth.unauthorized' } },
        { status: 401, headers: NO_STORE },
      );
    }
    return Response.json({ activated: await deps.activate() }, { headers: NO_STORE });
  };
}
