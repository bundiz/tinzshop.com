import { getCatalogueCategoriseHandler } from '@/server/composition-root';

// Development only (D-143): 404 in production. `Authorization: Bearer <JOB_SECRET>` otherwise.
export async function POST(request: Request): Promise<Response> {
  return getCatalogueCategoriseHandler()(request);
}
