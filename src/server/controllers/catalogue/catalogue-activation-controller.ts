import { isJobAuthorized } from '@/server/controllers/shared/job-auth';

// A job response is never cacheable.
const NO_STORE = { 'Cache-Control': 'no-store' };

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
    if (!isJobAuthorized(request.headers.get('authorization'), deps.jobSecret())) {
      return Response.json(
        { error: { code: 'auth.unauthorized', messageKey: 'error.auth.unauthorized' } },
        { status: 401, headers: NO_STORE },
      );
    }
    return Response.json({ activated: await deps.activate() }, { headers: NO_STORE });
  };
}
