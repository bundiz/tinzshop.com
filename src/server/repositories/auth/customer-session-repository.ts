import { getPrisma } from '@/server/repositories/shared/prisma';

import type { CustomerRecord } from './customer-repository';

export type NewCustomerSession = {
  tokenHash: string;
  customerId: string;
  refreshTokenSealed: string;
  accessTokenSealed: string;
  accessTokenExpiresAt: Date;
  expiresAt: Date;
};

export type CustomerSessionRecord = NewCustomerSession & { id: string };

export async function insertCustomerSession(row: NewCustomerSession): Promise<void> {
  await getPrisma().customerSession.create({ data: row });
}

export async function findCustomerSession(
  tokenHash: string,
): Promise<(CustomerSessionRecord & { customer: CustomerRecord }) | null> {
  const row = await getPrisma().customerSession.findUnique({
    where: { tokenHash },
    include: {
      customer: {
        select: { id: true, cognitoSub: true, email: true, firstName: true, lastName: true },
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
    customer: row.customer,
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
