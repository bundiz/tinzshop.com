import { isJobAuthorized } from "@/server/controllers/shared/job-auth";

// A job response is never cacheable.
const NO_STORE = { "Cache-Control": "no-store" };

/** Development-only (D-143): the endpoint does not exist in production, so the 404 comes before auth. */
export function createCatalogueCategoriseJobHandler(deps: {
  isProduction: boolean;
  jobSecret: () => string;
  categorise: () => Promise<{ categorised: number; skipped: number }>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    if (deps.isProduction) {
      return new Response("Not Found", { status: 404, headers: NO_STORE });
    }
    if (
      !isJobAuthorized(request.headers.get("authorization"), deps.jobSecret())
    ) {
      return Response.json(
        {
          error: {
            code: "auth.unauthorized",
            messageKey: "error.auth.unauthorized",
          },
        },
        { status: 401, headers: NO_STORE },
      );
    }
    return Response.json(await deps.categorise(), { headers: NO_STORE });
  };
}
