import { Client } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDatabaseUrl } from '@/server/config';
import { upsertCustomerBySub } from '@/server/repositories/auth/customer-repository';
import { resetDatabase } from '../setup/database';

let client: Client;

beforeEach(async () => {
  await resetDatabase();
  client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();
});

afterEach(async () => {
  await client.end();
});

const ROLE_KEYS = ['admin', 'blogger', 'customer', 'guest', 'sale_manager', 'super_admin'];

const DEFAULT_GRANTS: Record<string, string[]> = {
  'backoffice.enter': ['admin', 'blogger', 'sale_manager', 'super_admin'],
  'news.manage': ['admin', 'blogger', 'super_admin'],
  'account.manage': ['super_admin'],
  'role.manage': ['super_admin'],
};

describe('access schema', () => {
  it('seeds the six roles and four permissions with the default grants', async () => {
    const roles = await client.query('SELECT key, is_system FROM role ORDER BY key');
    expect(roles.rows.map((r) => r.key)).toEqual(ROLE_KEYS);
    expect(roles.rows.every((r) => r.is_system === true)).toBe(true);

    const permissions = await client.query('SELECT key FROM permission ORDER BY key');
    expect(permissions.rows.map((r) => r.key)).toEqual(Object.keys(DEFAULT_GRANTS).sort());

    const grants = await client.query(
      `SELECT p.key AS permission, r.key AS role
         FROM role_permission rp
         JOIN permission p ON p.id = rp.permission_id
         JOIN role r ON r.id = rp.role_id
        ORDER BY p.key, r.key`,
    );
    const held: Record<string, string[]> = {};
    for (const row of grants.rows) (held[row.permission] ??= []).push(row.role);
    expect(held).toEqual(DEFAULT_GRANTS);
  });

  it('gives every customer a role, and a new account defaults to the customer role', async () => {
    const result = await upsertCustomerBySub({ sub: 's-role', email: 'role@example.com', firstName: 'Ann', lastName: null });
    expect(result.ok).toBe(true);
    const rows = await client.query(
      'SELECT r.key, c.blocked_at FROM customer c JOIN role r ON r.id = c.role_id',
    );
    expect(rows.rows).toEqual([{ key: 'customer', blocked_at: null }]);
    const nulls = await client.query('SELECT count(*)::int AS n FROM customer WHERE role_id IS NULL');
    expect(nulls.rows[0].n).toBe(0);
  });

  it('a news staff id must reference a customer', async () => {
    await expect(
      client.query(
        `INSERT INTO news_article (slug, author_staff_id) VALUES ('bad-author', gen_random_uuid())`,
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('sets a news staff id to null when the customer row goes', async () => {
    const made = await upsertCustomerBySub({ sub: 's-del', email: 'del@example.com', firstName: 'Ann', lastName: null });
    if (!made.ok) throw new Error('expected a customer');
    await client.query(`INSERT INTO news_article (slug, author_staff_id) VALUES ('kept', $1)`, [made.customer.id]);
    await client.query('DELETE FROM customer WHERE id = $1', [made.customer.id]);
    const row = await client.query(`SELECT author_staff_id FROM news_article WHERE slug = 'kept'`);
    expect(row.rows[0].author_staff_id).toBeNull();
  });

  it('a tag name is unique case-insensitively', async () => {
    await client.query(`INSERT INTO news_tag (name, name_key) VALUES ('Switch 2', 'switch 2')`);
    await expect(
      client.query(`INSERT INTO news_tag (name, name_key) VALUES (' switch 2 ', 'switch 2')`),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('a tag name key must be the lower-cased, trimmed name', async () => {
    await expect(
      client.query(`INSERT INTO news_tag (name, name_key) VALUES ('Switch 2', 'wrong')`),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
