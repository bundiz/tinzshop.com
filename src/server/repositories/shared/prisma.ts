import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { getDatabaseUrl } from '@/server/config';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
}

let instance: PrismaClient | undefined;

/** Singleton Prisma client; in development it is also cached on globalThis so hot reload keeps one pool. */
export function getPrisma(): PrismaClient {
  if (process.env.NODE_ENV !== 'production') {
    return (globalForPrisma.prisma ??= createPrisma());
  }
  return (instance ??= createPrisma());
}
