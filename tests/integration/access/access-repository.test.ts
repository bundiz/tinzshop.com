import { Client } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDatabaseUrl } from '@/server/config';
import {
  changeAccountRole,
  findAccountByEmail,
  findAccountState,
  listRoleGrants,
  replaceRolePermissions,
  searchAccounts,
  setAccountBlocked,
} from '@/server/repositories/access/access-repository';
import { resetDatabase } from '../setup/database';

let client: Client;

beforeEach(async () => {
  await resetDatabase();
  client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();
});

afterEach(async () => {
  // The role tables survive resetDatabase, so put the seeded grants back for later tests.
  await client.query(
    `DELETE FROM role_permission;
     INSERT INTO role_permission (role_id, permission_id)
     SELECT r.id, p.id FROM (VALUES
       ('backoffice.enter','blogger'),('backoffice.enter','sale_manager'),('backoffice.enter','admin'),('backoffice.enter','super_admin'),
       ('news.manage','blogger'),('news.manage','admin'),('news.manage','super_admin'),
       ('account.manage','super_admin'),('role.manage','super_admin')
     ) AS g (pk, rk) JOIN permission p ON p.key = g.pk JOIN role r ON r.key = g.rk`,
  );
  await client.end();
});

let counter = 0;
async function makeAccount(
  roleKey: string,
  opts: { blocked?: boolean; email?: string; firstName?: string; lastName?: string | null; createdAt?: string } = {},
): Promise<string> {
  counter += 1;
  const result = await client.query<{ id: string }>(
    `INSERT INTO customer (cognito_sub, email, first_name, last_name, role_id, blocked_at, created_at)
     VALUES ($1, $2, $3, $4, (SELECT id FROM role WHERE key = $5), $6, COALESCE($7::timestamptz, now()))
     RETURNING id`,
    [
      `sub-${counter}`,
      opts.email ?? `user${counter}@example.com`,
      opts.firstName ?? 'Test',
      opts.lastName ?? null,
      roleKey,
      opts.blocked ? new Date() : null,
      opts.createdAt ?? null,
    ],
  );
  return result.rows[0]!.id;
}

async function roleOf(id: string): Promise<string> {
  const r = await client.query<{ key: string }>('SELECT r.key FROM customer c JOIN role r ON r.id = c.role_id WHERE c.id = $1', [id]);
  return r.rows[0]!.key;
}

describe('access repository guard', () => {
  it('refuses to demote the last unblocked super_admin', async () => {
    const a = await makeAccount('super_admin');
    expect(await changeAccountRole(a, 'admin')).toBe('last_super_admin');
    expect(await roleOf(a)).toBe('super_admin');
  });

  it('refuses to block the last unblocked super_admin', async () => {
    const a = await makeAccount('super_admin');
    expect(await setAccountBlocked(a, true)).toBe('last_super_admin');
    const r = await client.query('SELECT blocked_at FROM customer WHERE id = $1', [a]);
    expect(r.rows[0].blocked_at).toBeNull();
  });

  it('allows demoting a super_admin while another unblocked one remains', async () => {
    const a = await makeAccount('super_admin');
    await makeAccount('super_admin');
    expect(await changeAccountRole(a, 'admin')).toBe('changed');
    expect(await roleOf(a)).toBe('admin');
    expect(await changeAccountRole(a, 'admin')).toBe('unchanged');
  });

  /** Holds both rows locked, starts both calls, waits until two backends are blocked on a lock, then releases. */
  async function raceBehindLock<T>(ids: string[], start: () => Promise<T>[]): Promise<T[]> {
    const holder = new Client({ connectionString: getDatabaseUrl() });
    await holder.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT id FROM customer WHERE id = ANY($1::uuid[]) FOR UPDATE', [ids]);
      const calls = start();
      const deadline = Date.now() + 10_000;
      for (;;) {
        const waiting = await client.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
        );
        if (waiting.rows[0]!.n >= 2) break;
        if (Date.now() > deadline) throw new Error('the two calls never both waited on a lock');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await holder.query('COMMIT');
      return await Promise.all(calls);
    } finally {
      await holder.query('ROLLBACK').catch(() => undefined);
      await holder.end();
    }
  }

  async function unblockedSuperAdmins(): Promise<number> {
    const left = await client.query(
      "SELECT count(*)::int AS n FROM customer c JOIN role r ON r.id = c.role_id WHERE r.key = 'super_admin' AND c.blocked_at IS NULL",
    );
    return left.rows[0].n;
  }

  it('two concurrent demotions of the only two super_admins: exactly one succeeds', async () => {
    const a = await makeAccount('super_admin');
    const b = await makeAccount('super_admin');
    const results = await raceBehindLock([a, b], () => [changeAccountRole(a, 'admin'), changeAccountRole(b, 'admin')]);
    expect([...results].sort()).toEqual(['changed', 'last_super_admin']);
    expect(await unblockedSuperAdmins()).toBe(1);
  });

  it('blocking one of the only two super_admins races demoting the other: exactly one succeeds', async () => {
    const a = await makeAccount('super_admin');
    const b = await makeAccount('super_admin');
    const results = await raceBehindLock([a, b], () => [setAccountBlocked(a, true), changeAccountRole(b, 'admin')]);
    expect([...results].sort()).toEqual(['changed', 'last_super_admin']);
    expect(await unblockedSuperAdmins()).toBe(1);
  });

  it('a blocked super_admin does not count', async () => {
    const a = await makeAccount('super_admin');
    await makeAccount('super_admin', { blocked: true });
    expect(await changeAccountRole(a, 'admin')).toBe('last_super_admin');
    expect(await setAccountBlocked(a, true)).toBe('last_super_admin');
  });

  it('reports an unknown account', async () => {
    expect(await changeAccountRole('00000000-0000-4000-8000-000000000000', 'admin')).toBe('unknown_account');
    expect(await setAccountBlocked('00000000-0000-4000-8000-000000000000', true)).toBe('unknown_account');
  });

  it('blocking deletes every session of the account', async () => {
    await makeAccount('super_admin');
    const id = await makeAccount('customer');
    const other = await makeAccount('customer');
    for (const [owner, hash] of [[id, 'h1'], [id, 'h2'], [other, 'h3']] as const) {
      await client.query(
        `INSERT INTO customer_session (token_hash, customer_id, refresh_token_sealed, access_token_sealed, access_token_expires_at, expires_at)
         VALUES ($1, $2, 'r', 'a', now() + interval '1 hour', now() + interval '1 day')`,
        [hash, owner],
      );
    }
    expect(await setAccountBlocked(id, true)).toBe('changed');
    const mine = await client.query('SELECT count(*)::int AS n FROM customer_session WHERE customer_id = $1', [id]);
    const theirs = await client.query('SELECT count(*)::int AS n FROM customer_session WHERE customer_id = $1', [other]);
    expect(mine.rows[0].n).toBe(0);
    expect(theirs.rows[0].n).toBe(1);
    expect(await setAccountBlocked(id, true)).toBe('unchanged');
    expect(await setAccountBlocked(id, false)).toBe('changed');
  });
});

describe('access repository reads and grants', () => {
  it('searchAccounts finds by part of the email or name, filters by role and blocked, newest first', async () => {
    const old = await makeAccount('customer', { email: 'zed.old@example.com', firstName: 'Somchai', createdAt: '2026-01-01T00:00:00Z' });
    const mid = await makeAccount('blogger', { email: 'mid@example.com', firstName: 'Nok', lastName: 'SOMSRI', createdAt: '2026-02-01T00:00:00Z' });
    const recent = await makeAccount('customer', { email: 'zed.new@example.com', firstName: 'ANN LEE', blocked: true, createdAt: '2026-03-01T00:00:00Z' });

    const byEmail = await searchAccounts({ query: 'zed.', roleKey: null, blocked: null, skip: 0, take: 10 });
    expect(byEmail.total).toBe(2);
    expect(byEmail.rows.map((r) => r.id)).toEqual([recent, old]);

    const byName = await searchAccounts({ query: 'SOM', roleKey: null, blocked: null, skip: 0, take: 10 });
    expect(byName.rows.map((r) => r.id)).toEqual([mid, old]);

    const byRole = await searchAccounts({ query: '', roleKey: 'blogger', blocked: null, skip: 0, take: 10 });
    expect(byRole.rows.map((r) => r.id)).toEqual([mid]);
    expect(byRole.rows[0]!.roleKey).toBe('blogger');

    const blocked = await searchAccounts({ query: '', roleKey: null, blocked: true, skip: 0, take: 10 });
    expect(blocked.rows.map((r) => r.id)).toEqual([recent]);
    const unblocked = await searchAccounts({ query: '', roleKey: null, blocked: false, skip: 1, take: 1 });
    expect(unblocked.total).toBe(2);
    expect(unblocked.rows.map((r) => r.id)).toEqual([old]);
  });

  it('finds an account by email in any case', async () => {
    const id = await makeAccount('admin', { email: 'staff@example.com' });
    expect(await findAccountByEmail(' Staff@Example.com ')).toEqual({ id, roleKey: 'admin' });
    expect(await findAccountByEmail('nobody@example.com')).toBeNull();
  });

  it("replaceRolePermissions replaces the role's grants", async () => {
    const before = await listRoleGrants();
    expect([...before.blogger].sort()).toEqual(['backoffice.enter', 'news.manage']);
    expect(before.customer).toEqual([]);
    await replaceRolePermissions('blogger', ['backoffice.enter', 'role.manage']);
    const after = await listRoleGrants();
    expect([...after.blogger].sort()).toEqual(['backoffice.enter', 'role.manage']);
    expect([...after.admin].sort()).toEqual(['backoffice.enter', 'news.manage']);
  });
});

describe('findAccountState', () => {
  it('returns the role and the blocked flag, and null for an unknown id', async () => {
    const id = await makeAccount('blogger', { blocked: true });
    expect(await findAccountState(id)).toEqual({ roleKey: 'blogger', blocked: true });
    expect(await findAccountState('00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});
