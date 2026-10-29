import { getCatalogueActivationHandler } from '@/server/composition-root';

// Development only (D-117): 404 in production. `Authorization: Bearer <JOB_SECRET>` otherwise.
export async function POST(request: Request): Promise<Response> {
  return getCatalogueActivationHandler()(request);
}
