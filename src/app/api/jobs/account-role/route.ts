import { getAccountRoleHandler } from '@/server/composition-root';

// Run by hand with `npm run account:set-role -- <email> <role>`; works in every environment (D-235).
export async function POST(request: Request): Promise<Response> {
  return getAccountRoleHandler()(request);
}
