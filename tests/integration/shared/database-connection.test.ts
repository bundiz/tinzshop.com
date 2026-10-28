import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '@/server/config';
import { resetDatabase } from '../setup/database';

describe('test database', () => {
  it('connects to the test database', async () => {
    const client = new Client({ connectionString: getDatabaseUrl() });
    await client.connect();
    try {
      const result = await client.query<{ current_database: string }>('SELECT current_database()');
      expect(result.rows[0]?.current_database).toBe('tinzshop_test');
    } finally {
      await client.end();
    }
  });

  it('resets the database without error when there are no application tables', async () => {
    await expect(resetDatabase()).resolves.toBeUndefined();
  });
});
