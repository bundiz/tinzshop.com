import { Prisma } from '@/generated/prisma/client';

import { getPrisma } from '@/server/repositories/shared/prisma';

export type CustomerRecord = {
  id: string;
  cognitoSub: string;
  email: string;
  firstName: string;
  lastName: string | null;
};

export type UpsertCustomerInput = {
  sub: string;
  email: string;
  firstName: string;
  lastName: string | null;
};

export type UpsertCustomerResult =
  | { ok: true; customer: CustomerRecord }
  | { ok: false; reason: 'email_taken' };

/** The violated unique index: from `meta.target` (query engine) or the driver adapter's cause. */
function violatedIndex(error: Prisma.PrismaClientKnownRequestError): string {
  const meta = error.meta as
    | { target?: unknown; driverAdapterError?: { cause?: { constraint?: { index?: string } } } }
    | undefined;
  const target = meta?.target;
  if (Array.isArray(target)) return target.join(',');
  if (typeof target === 'string') return target;
  return meta?.driverAdapterError?.cause?.constraint?.index ?? '';
}

function targetsColumn(error: Prisma.PrismaClientKnownRequestError, column: string): boolean {
  return violatedIndex(error).includes(column);
}

/**
 * Creates the customer on first sign-in, or refreshes the email on later ones. Names are written on
 * create only (D-166). The email is lowercased here. An email held by a different sub is refused,
 * never overwritten.
 */
export async function upsertCustomerBySub(input: UpsertCustomerInput): Promise<UpsertCustomerResult> {
  const email = input.email.toLowerCase();
  const run = () =>
    getPrisma().customer.upsert({
      where: { cognitoSub: input.sub },
      create: {
        cognitoSub: input.sub,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
      },
      update: { email },
      select: { id: true, cognitoSub: true, email: true, firstName: true, lastName: true },
    });

  for (let attempt = 0; ; attempt += 1) {
    try {
      return { ok: true, customer: await run() };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        if (targetsColumn(error, 'email')) return { ok: false, reason: 'email_taken' };
        // A concurrent first sign-in for the same sub won the insert: the row exists now, so retry once.
        if (targetsColumn(error, 'cognito_sub') && attempt < 2) continue;
      }
      throw error;
    }
  }
}

/** The customer row for this email (lowercased here), or null when the person never signed in on the site. */
export async function findCustomerByEmail(email: string): Promise<CustomerRecord | null> {
  return getPrisma().customer.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, cognitoSub: true, email: true, firstName: true, lastName: true },
  });
}
