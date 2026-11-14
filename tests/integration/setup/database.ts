import { Client } from 'pg';
import { getDatabaseUrl } from '@/server/config';

/** Truncates every application table except the migration-seeded role tables. Refuses to run outside a `_test` database. */
export async function resetDatabase(): Promise<void> {
  const client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();
  try {
    const current = await client.query<{ current_database: string }>('SELECT current_database()');
    const name = current.rows[0]?.current_database ?? '';
    if (!name.endsWith('_test')) {
      throw new Error('resetDatabase refuses to run: the connected database is not a _test database');
    }
    // The role tables are seeded by a migration and every customer row points at one, so they stay.
    const tables = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'role', 'permission', 'role_permission')",
    );
    if (tables.rows.length === 0) return;
    const list = tables.rows.map((row) => `"public"."${row.tablename.replaceAll('"', '""')}"`).join(', ');
    await client.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}
