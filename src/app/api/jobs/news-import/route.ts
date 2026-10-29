import { getNewsImportHandler } from '@/server/composition-root';

// Run by hand (and once at go-live) with `Authorization: Bearer <JOB_SECRET>`; safe to re-run.
export async function POST(request: Request): Promise<Response> {
  return getNewsImportHandler()(request);
}
