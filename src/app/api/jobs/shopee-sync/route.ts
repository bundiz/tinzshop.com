import { getServerConfig } from '@/server/config';
import { getCatalogueSyncRunner } from '@/server/composition-root';
import { createCatalogueSyncJobHandler } from '@/server/controllers/catalogue-sync-controller';

// Called by any scheduler (every 10 minutes) with `Authorization: Bearer <JOB_SECRET>`.
export async function POST(request: Request): Promise<Response> {
  const handler = createCatalogueSyncJobHandler({
    jobSecret: getServerConfig().jobSecret,
    runSync: getCatalogueSyncRunner(),
  });
  return handler(request);
}
