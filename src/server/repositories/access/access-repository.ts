import { Prisma } from '@/generated/prisma/client';

import { ROLE_KEYS, type PermissionKey, type RoleKey } from '@/server/services/access/permission-keys';
import { ACCOUNT_ROLE_BOOTSTRAP_LOCK_KEY } from '@/server/repositories/shared/advisory-lock';
import { getPrisma } from '@/server/repositories/shared/prisma';

export type AccountRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  roleKey: RoleKey;
  blockedAt: Date | null;
  createdAt: Date;
};

export type ChangeResult = 'changed' | 'unchanged' | 'last_super_admin' | 'unknown_account';

/** Every role's granted permission keys, a role with none mapped to an empty list. */
export async function listRoleGrants(): Promise<Record<RoleKey, PermissionKey[]>> {
  const grants = Object.fromEntries(ROLE_KEYS.map((key) => [key, [] as PermissionKey[]])) as Record<RoleKey, PermissionKey[]>;
  const rows = await getPrisma().rolePermission.findMany({
    select: { role: { select: { key: true } }, permission: { select: { key: true } } },
  });
  for (const row of rows) grants[row.role.key as RoleKey].push(row.permission.key as PermissionKey);
  return grants;
}

/** Replaces the role's grants with exactly these keys, in one transaction. */
export async function replaceRolePermissions(roleKey: RoleKey, keys: readonly PermissionKey[]): Promise<void> {
  await getPrisma().$transaction(async (tx) => {
    const role = await tx.role.findUniqueOrThrow({ where: { key: roleKey }, select: { id: true } });
    const permissions = await tx.permission.findMany({ where: { key: { in: [...keys] } }, select: { id: true } });
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    });
  });
}

export async function searchAccounts(input: {
  query: string;
  roleKey: RoleKey | null;
  blocked: boolean | null;
  skip: number;
  take: number;
}): Promise<{ total: number; rows: AccountRow[] }> {
  const query = input.query.trim();
  const where: Prisma.CustomerWhereInput = {
    ...(query === ''
      ? {}
      : {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ],
        }),
    ...(input.roleKey === null ? {} : { role: { key: input.roleKey } }),
    ...(input.blocked === null ? {} : { blockedAt: input.blocked ? { not: null } : null }),
  };
  const prisma = getPrisma();
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: input.skip,
      take: input.take,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        blockedAt: true,
        createdAt: true,
        role: { select: { key: true } },
      },
    }),
  ]);
  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      roleKey: row.role.key as RoleKey,
      blockedAt: row.blockedAt,
      createdAt: row.createdAt,
    })),
  };
}

export async function findAccountByEmail(email: string): Promise<{ id: string; roleKey: RoleKey } | null> {
  const row = await getPrisma().customer.findFirst({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
    select: { id: true, role: { select: { key: true } } },
  });
  return row === null ? null : { id: row.id, roleKey: row.role.key as RoleKey };
}

type Target = { id: string; role_key: string; blocked_at: Date | null };

/**
 * Runs a change inside one transaction that first locks every super_admin row, then the target.
 * Two concurrent changes lock the same rows, so the second waits and then sees the first's result
 * (READ COMMITTED re-checks the role filter on rows the first changed). `apply` runs only when
 * the change would not leave the shop without an unblocked super_admin.
 */
async function guardedChange(
  accountId: string,
  isNoop: (target: Target) => boolean,
  afterChange: (target: Target) => { isUnblockedSuperAdmin: boolean },
  apply: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<ChangeResult> {
  return getPrisma().$transaction(async (tx) => {
    const supers = await tx.$queryRaw<{ id: string; blocked_at: Date | null }[]>`
      SELECT c.id, c.blocked_at FROM customer c JOIN role r ON r.id = c.role_id
      WHERE r.key = 'super_admin' ORDER BY c.id FOR UPDATE OF c`;
    const targets = await tx.$queryRaw<Target[]>`
      SELECT c.id, r.key AS role_key, c.blocked_at FROM customer c JOIN role r ON r.id = c.role_id
      WHERE c.id = ${accountId}::uuid FOR UPDATE OF c`;
    const target = targets[0];
    if (target === undefined) return 'unknown_account';
    if (isNoop(target)) return 'unchanged';

    const countsNow = target.role_key === 'super_admin' && target.blocked_at === null;
    if (countsNow && !afterChange(target).isUnblockedSuperAdmin) {
      const others = supers.filter((s) => s.id !== target.id && s.blocked_at === null).length;
      if (others === 0) return 'last_super_admin';
    }
    await apply(tx);
    return 'changed';
  });
}

export async function changeAccountRole(accountId: string, roleKey: RoleKey): Promise<ChangeResult> {
  return guardedChange(
    accountId,
    (target) => target.role_key === roleKey,
    (target) => ({ isUnblockedSuperAdmin: roleKey === 'super_admin' && target.blocked_at === null }),
    async (tx) => {
      const role = await tx.role.findUniqueOrThrow({ where: { key: roleKey }, select: { id: true } });
      await tx.customer.update({ where: { id: accountId }, data: { roleId: role.id } });
    },
  );
}

export type BootstrapResult = 'changed' | 'unchanged' | 'super_admin_exists' | 'unknown_account';

/**
 * The account-role job's change (D-235, R18): sets the role only while no unblocked super_admin exists, so it can only make
 * the first Top-level Admin, or the way back after every one is blocked. The check and the change run in one transaction
 * behind a transaction-level advisory lock, so two jobs at once cannot both pass an empty check; the super_admin rows are
 * locked too, so a change made in the back office at the same moment is waited for.
 */
export async function bootstrapAccountRole(accountId: string, roleKey: RoleKey): Promise<BootstrapResult> {
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ACCOUNT_ROLE_BOOTSTRAP_LOCK_KEY}::bigint)`;
    const supers = await tx.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM customer c JOIN role r ON r.id = c.role_id
      WHERE r.key = 'super_admin' AND c.blocked_at IS NULL ORDER BY c.id FOR UPDATE OF c`;
    if (supers.length > 0) return 'super_admin_exists';
    const targets = await tx.$queryRaw<Target[]>`
      SELECT c.id, r.key AS role_key, c.blocked_at FROM customer c JOIN role r ON r.id = c.role_id
      WHERE c.id = ${accountId}::uuid FOR UPDATE OF c`;
    const target = targets[0];
    if (target === undefined) return 'unknown_account';
    if (target.role_key === roleKey) return 'unchanged';
    const role = await tx.role.findUniqueOrThrow({ where: { key: roleKey }, select: { id: true } });
    await tx.customer.update({ where: { id: accountId }, data: { roleId: role.id } });
    return 'changed';
  });
}

/** Blocking sets blocked_at and deletes the account's sessions in the same transaction. */
export async function setAccountBlocked(accountId: string, blocked: boolean): Promise<ChangeResult> {
  return guardedChange(
    accountId,
    (target) => (target.blocked_at !== null) === blocked,
    (target) => ({ isUnblockedSuperAdmin: target.role_key === 'super_admin' && !blocked }),
    async (tx) => {
      await tx.customer.update({ where: { id: accountId }, data: { blockedAt: blocked ? new Date() : null } });
      if (blocked) await tx.customerSession.deleteMany({ where: { customerId: accountId } });
    },
  );
}

/** An account's role and blocked flag, or null: read for the back office's log of the old value (D-242). */
export async function findAccountState(accountId: string): Promise<{ roleKey: RoleKey; blocked: boolean } | null> {
  const row = await getPrisma().customer.findUnique({
    where: { id: accountId },
    select: { blockedAt: true, role: { select: { key: true } } },
  });
  return row === null ? null : { roleKey: row.role.key as RoleKey, blocked: row.blockedAt !== null };
}
