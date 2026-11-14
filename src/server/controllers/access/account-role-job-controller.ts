import { z } from 'zod';

import { isJobAuthorized } from '@/server/controllers/shared/job-auth';
import { ASSIGNABLE_ROLE_KEYS, type RoleKey } from '@/server/services/access/permission-keys';

const NO_STORE = { 'Cache-Control': 'no-store' };

// Same normalisation as customer sign-in (plan 014): trim, then lowercase. `guest` is not assignable.
const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ASSIGNABLE_ROLE_KEYS),
});

type ChangeResult = 'changed' | 'unchanged' | 'last_super_admin' | 'unknown_account';

/**
 * `POST /api/jobs/account-role` (plan 016, D-235): sets one account's role, which is how the first
 * Top-level Admin is made. Works in every environment. Order: the secret (401), the body (400), the
 * account (404), the change (404, 409 or 200). The log carries the account id and roles, never the email (D-242).
 */
export function createAccountRoleJobHandler(deps: {
  jobSecret: () => string;
  findAccountByEmail: (email: string) => Promise<{ id: string; roleKey: RoleKey } | null>;
  changeAccountRole: (accountId: string, roleKey: RoleKey) => Promise<ChangeResult>;
  log: (message: string) => void;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!isJobAuthorized(request.headers.get('authorization'), deps.jobSecret())) {
      return Response.json(
        { error: { code: 'auth.unauthorized', messageKey: 'error.auth.unauthorized' } },
        { status: 401, headers: NO_STORE },
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return Response.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
    }
    const { email, role } = parsed.data;

    const account = await deps.findAccountByEmail(email);
    if (account === null) {
      return Response.json({ error: 'unknown_account' }, { status: 404, headers: NO_STORE });
    }

    const result = await deps.changeAccountRole(account.id, role);
    deps.log(`account-role job: account ${account.id} role ${account.roleKey} -> ${role}: ${result}`);

    if (result === 'unknown_account') {
      return Response.json({ error: 'unknown_account' }, { status: 404, headers: NO_STORE });
    }
    if (result === 'last_super_admin') {
      return Response.json({ error: 'last_super_admin' }, { status: 409, headers: NO_STORE });
    }
    return Response.json({ result, role }, { headers: NO_STORE });
  };
}
