import { z } from 'zod';

import { can, checkRolePermissions } from '@/server/services/access/access-service';
import {
  ASSIGNABLE_ROLE_KEYS,
  PERMISSION_KEYS,
  ROLE_KEYS,
  type PermissionKey,
  type RoleKey,
} from '@/server/services/access/permission-keys';

type ChangeResult = 'changed' | 'unchanged' | 'last_super_admin' | 'unknown_account';

/** A key under `admin.error.*` in the message files. */
export type AccountAdminErrorKey =
  | 'forbidden'
  | 'invalid'
  | 'lastSuperAdmin'
  | 'unknownAccount'
  | 'superAdminLocked'
  | 'backOfficeKeyForCustomer';

/** What a back-office form shows after it runs (plan 016, Task 8). */
export type AccountAdminState = { status: 'idle' } | { status: 'ok' } | { status: 'error'; errorKey: AccountAdminErrorKey };

export type AccountAdminActor = { id: string; permissions: readonly PermissionKey[] };

export type AccountAdminDeps = {
  /** The account's current role and blocked flag, read only for the log's "old value". */
  findAccount: (accountId: string) => Promise<{ roleKey: RoleKey; blocked: boolean } | null>;
  changeAccountRole: (accountId: string, roleKey: RoleKey) => Promise<ChangeResult>;
  setAccountBlocked: (accountId: string, blocked: boolean) => Promise<ChangeResult>;
  listRoleGrants: () => Promise<Record<RoleKey, PermissionKey[]>>;
  replaceRolePermissions: (roleKey: RoleKey, keys: readonly PermissionKey[]) => Promise<void>;
  /** Logs ids, role keys and permission keys only (D-242). */
  log: (message: string, fields: Record<string, unknown>) => void;
};

const error = (errorKey: AccountAdminErrorKey): AccountAdminState => ({ status: 'error', errorKey });
const INVALID = error('invalid');

const accountId = z.uuid();
const roleChange = z.object({ accountId, roleKey: z.enum(ASSIGNABLE_ROLE_KEYS) });
const blockChange = z.object({ accountId, blocked: z.enum(['true', 'false']) });
const permissionSave = z.object({ roleKey: z.enum(ROLE_KEYS), keys: z.array(z.enum(PERMISSION_KEYS)) });

function mapResult(result: ChangeResult): AccountAdminErrorKey | null {
  if (result === 'last_super_admin') return 'lastSuperAdmin';
  if (result === 'unknown_account') return 'unknownAccount';
  return null;
}

/** Sets an account's role (`account.manage`). `guest` is not assignable. */
export async function changeAccountRoleCommand(
  deps: AccountAdminDeps,
  actor: AccountAdminActor,
  formData: FormData,
): Promise<AccountAdminState> {
  if (!can(actor, 'account.manage')) return error('forbidden');
  const parsed = roleChange.safeParse({ accountId: formData.get('accountId'), roleKey: formData.get('roleKey') });
  if (!parsed.success) return INVALID;
  const { accountId: id, roleKey } = parsed.data;

  const before = await deps.findAccount(id);
  const result = await deps.changeAccountRole(id, roleKey);
  const failure = mapResult(result);
  if (failure !== null) return error(failure);
  if (result === 'changed') deps.log('account.role_changed', { actor: actor.id, account: id, from: before?.roleKey ?? null, to: roleKey });
  return { status: 'ok' };
}

/** Blocks or unblocks an account (`account.manage`); blocking also ends its sessions (in the repository). */
export async function setAccountBlockedCommand(
  deps: AccountAdminDeps,
  actor: AccountAdminActor,
  formData: FormData,
): Promise<AccountAdminState> {
  if (!can(actor, 'account.manage')) return error('forbidden');
  const parsed = blockChange.safeParse({ accountId: formData.get('accountId'), blocked: formData.get('blocked') });
  if (!parsed.success) return INVALID;
  const id = parsed.data.accountId;
  const blocked = parsed.data.blocked === 'true';

  const before = await deps.findAccount(id);
  const result = await deps.setAccountBlocked(id, blocked);
  const failure = mapResult(result);
  if (failure !== null) return error(failure);
  if (result === 'changed') deps.log('account.blocked_changed', { actor: actor.id, account: id, from: before?.blocked ?? null, to: blocked });
  return { status: 'ok' };
}

/** Replaces the permissions one role holds (`role.manage`), after the lock rules of spec section 5. */
export async function saveRolePermissionsCommand(
  deps: AccountAdminDeps,
  actor: AccountAdminActor,
  formData: FormData,
): Promise<AccountAdminState> {
  if (!can(actor, 'role.manage')) return error('forbidden');
  const parsed = permissionSave.safeParse({
    roleKey: formData.get('roleKey'),
    keys: formData.getAll('keys'),
  });
  if (!parsed.success) return INVALID;
  const { roleKey } = parsed.data;
  const keys = PERMISSION_KEYS.filter((key) => parsed.data.keys.includes(key));

  const check = checkRolePermissions(roleKey, keys);
  if (!check.ok) return error(check.reason === 'super_admin_locked' ? 'superAdminLocked' : 'backOfficeKeyForCustomer');

  const before = (await deps.listRoleGrants())[roleKey];
  await deps.replaceRolePermissions(roleKey, keys);
  deps.log('role.permissions_changed', { actor: actor.id, role: roleKey, from: before, to: keys });
  return { status: 'ok' };
}
