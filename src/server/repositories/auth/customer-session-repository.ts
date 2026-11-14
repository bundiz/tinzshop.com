import { getPrisma } from '@/server/repositories/shared/prisma';

import type { PermissionKey, RoleKey } from '@/server/services/access/permission-keys';

import type { CustomerRecord } from './customer-repository';

export type NewCustomerSession = {
  tokenHash: string;
  customerId: string;
  refreshTokenSealed: string;
  accessTokenSealed: string;
  accessTokenExpiresAt: Date;
  expiresAt: Date;
};

/** The customer on a session read: identity, the role key, the role's permission keys and the block time, in one query. */
export type SessionCustomer = CustomerRecord & {
  roleKey: RoleKey;
  permissions: PermissionKey[];
  blockedAt: Date | null;
};

export type CustomerSessionRecord = NewCustomerSession & { id: string };

export async function insertCustomerSession(row: NewCustomerSession): Promise<void> {
  await getPrisma().customerSession.create({ data: row });
}

export async function findCustomerSession(
  tokenHash: string,
): Promise<(CustomerSessionRecord & { customer: SessionCustomer }) | null> {
  const row = await getPrisma().customerSession.findUnique({
    where: { tokenHash },
    include: {
      customer: {
        select: {
          id: true,
          cognitoSub: true,
          email: true,
          firstName: true,
          lastName: true,
          blockedAt: true,
          role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } },
        },
      },
    },
  });
  if (row === null) return null;
  return {
    id: row.id,
    tokenHash: row.tokenHash,
    customerId: row.customerId,
    refreshTokenSealed: row.refreshTokenSealed,
    accessTokenSealed: row.accessTokenSealed,
    accessTokenExpiresAt: row.accessTokenExpiresAt,
    expiresAt: row.expiresAt,
    customer: {
      id: row.customer.id,
      cognitoSub: row.customer.cognitoSub,
      email: row.customer.email,
      firstName: row.customer.firstName,
      lastName: row.customer.lastName,
      blockedAt: row.customer.blockedAt,
      roleKey: row.customer.role.key as RoleKey,
      permissions: row.customer.role.permissions.map((grant) => grant.permission.key as PermissionKey),
    },
  };
}

export async function updateSessionAccessToken(id: string, sealed: string, expiresAt: Date): Promise<void> {
  await getPrisma().customerSession.update({
    where: { id },
    data: { accessTokenSealed: sealed, accessTokenExpiresAt: expiresAt },
  });
}

export async function deleteCustomerSession(tokenHash: string): Promise<void> {
  await getPrisma().customerSession.deleteMany({ where: { tokenHash } });
}

export async function deleteCustomerSessions(customerId: string): Promise<void> {
  await getPrisma().customerSession.deleteMany({ where: { customerId } });
}
