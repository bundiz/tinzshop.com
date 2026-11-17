import { z } from 'zod';

import { can, checkRolePermissions, type RoleGrant } from '@/server/services/access/access-service';
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
  /** Replaces the grants of every listed role, all in one transaction (D-262). */
  replaceRolePermissions: (grants: readonly RoleGrant[]) => Promise<void>;
  /** Logs ids, role keys and permission keys only (D-242). */
  log: (message: string, fields: Record<string, unknown>) => void;
};

const error = (errorKey: AccountAdminErrorKey): AccountAdminState => ({ status: 'error', errorKey });
const INVALID = error('invalid');

const accountId = z.uuid();
const roleChange = z.object({ accountId, roleKey: z.enum(ASSIGNABLE_ROLE_KEYS) });
const blockChange = z.object({ accountId, blocked: z.enum(['true', 'false']) });
const permissionSave = z.array(z.object({ roleKey: z.enum(ROLE_KEYS), keys: z.array(z.enum(PERMISSION_KEYS)) })).min(1);

/** The grid form's fields: each saved role under `roleKey`, its ticked keys under `keys.{roleKey}`. */
const KEYS_FIELD = 'keys.';

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

/**
 * Replaces the permissions of every role the grid lists (`role.manage`), all or nothing (D-262). Each role is listed under
 * `roleKey` and its ticked keys sent under `keys.{roleKey}`, so a role with nothing ticked is still saved, as empty. An unknown
 * or repeated role, an unknown key, or keys for a role the form does not list refuse the whole save; so does any role that
 * breaks the lock rules of spec section 5. The Top-level Admin is checked but never written: it always holds every key.
 */
export async function saveRolePermissionsCommand(
  deps: AccountAdminDeps,
  actor: AccountAdminActor,
  formData: FormData,
): Promise<AccountAdminState> {
  if (!can(actor, 'role.manage')) return error('forbidden');
  // The per-role form before D-262 sent its ticks as bare `keys`; read as this form, they would empty the role, so refuse.
  if (formData.has('keys')) return INVALID;
  const listed = formData.getAll('roleKey');
  const parsed = permissionSave.safeParse(listed.map((roleKey) => ({ roleKey, keys: formData.getAll(`${KEYS_FIELD}${String(roleKey)}`) })));
  if (!parsed.success) return INVALID;
  if (new Set(listed).size !== listed.length) return INVALID;
  for (const name of new Set(formData.keys())) {
    if (name.startsWith(KEYS_FIELD) && !listed.includes(name.slice(KEYS_FIELD.length))) return INVALID;
  }

  const saves = ROLE_KEYS.flatMap((roleKey) => {
    const entry = parsed.data.find((item) => item.roleKey === roleKey);
    return entry === undefined ? [] : [{ roleKey, permissionKeys: PERMISSION_KEYS.filter((key) => entry.keys.includes(key)) }];
  });
  for (const { roleKey, permissionKeys } of saves) {
    const check = checkRolePermissions(roleKey, permissionKeys);
    if (!check.ok) return error(check.reason === 'super_admin_locked' ? 'superAdminLocked' : 'backOfficeKeyForCustomer');
  }
  const writes = saves.filter((save) => save.roleKey !== 'super_admin');
  if (writes.length === 0) return { status: 'ok' };

  const before = await deps.listRoleGrants();
  await deps.replaceRolePermissions(writes);
  for (const { roleKey, permissionKeys } of writes) {
    const from = PERMISSION_KEYS.filter((key) => before[roleKey].includes(key));
    if (from.join() !== permissionKeys.join()) deps.log('role.permissions_changed', { actor: actor.id, role: roleKey, from, to: permissionKeys });
  }
  return { status: 'ok' };
}
