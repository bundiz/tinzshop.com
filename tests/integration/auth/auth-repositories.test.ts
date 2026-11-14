import { Client } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDatabaseUrl } from '@/server/config';
import { hitRateLimit } from '@/server/repositories/auth/auth-rate-limit-repository';
import { findCustomerByEmail, upsertCustomerBySub } from '@/server/repositories/auth/customer-repository';
import {
  deleteCustomerSessions,
  findCustomerSession,
  insertCustomerSession,
} from '@/server/repositories/auth/customer-session-repository';
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

async function makeCustomer(sub: string, email: string) {
  const result = await upsertCustomerBySub({ sub, email, firstName: 'Ann', lastName: null });
  if (!result.ok) throw new Error('expected a customer');
  return result.customer;
}

describe('customer repository', () => {
  it('finds a customer by email in any case, and null for an unknown one', async () => {
    const made = await makeCustomer('s-find', 'find@example.com');
    expect((await findCustomerByEmail(' Find@Example.com '))?.id).toBe(made.id);
    expect(await findCustomerByEmail('nobody@example.com')).toBeNull();
  });

  it('upsert creates once and keeps names on a second sign-in', async () => {
    const first = await upsertCustomerBySub({ sub: 's-1', email: 'a@example.com', firstName: 'Ann', lastName: 'Lee' });
    const second = await upsertCustomerBySub({ sub: 's-1', email: 'new@example.com', firstName: 'Other', lastName: null });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.customer.id).toBe(first.customer.id);
    expect(second.customer.firstName).toBe('Ann');
    expect(second.customer.lastName).toBe('Lee');
    expect(second.customer.email).toBe('new@example.com');
    const count = await client.query('SELECT count(*)::int AS n FROM customer');
    expect(count.rows[0].n).toBe(1);
  });

  it('two upserts for one sub at once make one row', async () => {
    const input = { sub: 's-race', email: 'race@example.com', firstName: 'Ann', lastName: null };
    const results = await Promise.all(Array.from({ length: 8 }, () => upsertCustomerBySub(input)));
    expect(results.every((r) => r.ok)).toBe(true);
    const count = await client.query('SELECT count(*)::int AS n FROM customer');
    expect(count.rows[0].n).toBe(1);
  });

  it('upsert refuses an email held by another sub', async () => {
    await makeCustomer('s-1', 'same@example.com');
    const result = await upsertCustomerBySub({ sub: 's-2', email: 'same@example.com', firstName: 'Bob', lastName: null });
    expect(result).toEqual({ ok: false, reason: 'email_taken' });
    const count = await client.query('SELECT count(*)::int AS n FROM customer');
    expect(count.rows[0].n).toBe(1);
  });

  it('email is stored lowercased', async () => {
    const customer = await makeCustomer('s-1', 'Mixed.Case@Example.COM');
    expect(customer.email).toBe('mixed.case@example.com');
    await expect(
      client.query(
        "INSERT INTO customer (cognito_sub, email, first_name) VALUES ('s-x', 'UPPER@example.com', 'X')",
      ),
    ).rejects.toThrow();
  });
});

describe('customer session repository', () => {
  it('session lookup returns the customer and deleting all sessions for a customer leaves others', async () => {
    const a = await makeCustomer('s-a', 'a@example.com');
    const b = await makeCustomer('s-b', 'b@example.com');
    const expiresAt = new Date('2026-12-01T00:00:00Z');
    const row = (tokenHash: string, customerId: string) => ({
      tokenHash,
      customerId,
      refreshTokenSealed: 'r',
      accessTokenSealed: 'a',
      accessTokenExpiresAt: new Date('2026-11-10T00:15:00Z'),
      expiresAt,
    });
    await insertCustomerSession(row('h1', a.id));
    await insertCustomerSession(row('h2', a.id));
    await insertCustomerSession(row('h3', b.id));

    const found = await findCustomerSession('h1');
    expect(found?.customer.email).toBe('a@example.com');
    expect(found?.refreshTokenSealed).toBe('r');
    expect(await findCustomerSession('missing')).toBeNull();

    await deleteCustomerSessions(a.id);
    expect(await findCustomerSession('h1')).toBeNull();
    expect(await findCustomerSession('h2')).toBeNull();
    expect((await findCustomerSession('h3'))?.customer.id).toBe(b.id);
  });
});

describe('customer session read of the role (plan 016)', () => {
  it('returns the exact role key, the role\'s permission keys and blockedAt, null then a date after blocking', async () => {
    const customer = await makeCustomer('s-role', 'role@example.com');
    // The seeded Blogger role holds exactly backoffice.enter and news.manage.
    await client.query("UPDATE customer SET role_id = (SELECT id FROM role WHERE key = 'blogger') WHERE id = $1", [customer.id]);
    await insertCustomerSession({
      tokenHash: 'role-h',
      customerId: customer.id,
      refreshTokenSealed: 'r',
      accessTokenSealed: 'a',
      accessTokenExpiresAt: new Date('2026-11-10T00:15:00Z'),
      expiresAt: new Date('2026-12-01T00:00:00Z'),
    });

    const before = await findCustomerSession('role-h');
    expect(before?.customer.roleKey).toBe('blogger');
    expect([...(before?.customer.permissions ?? [])].sort()).toEqual(['backoffice.enter', 'news.manage']);
    expect(before?.customer.blockedAt).toBeNull();

    await client.query('UPDATE customer SET blocked_at = now() WHERE id = $1', [customer.id]);
    const after = await findCustomerSession('role-h');
    expect(after?.customer.blockedAt).toBeInstanceOf(Date);
    expect(after?.customer.roleKey).toBe('blogger');
  });

  it('a customer on the Customer role has no permission keys', async () => {
    const customer = await makeCustomer('s-plain', 'plain@example.com');
    await insertCustomerSession({
      tokenHash: 'plain-h',
      customerId: customer.id,
      refreshTokenSealed: 'r',
      accessTokenSealed: 'a',
      accessTokenExpiresAt: new Date('2026-11-10T00:15:00Z'),
      expiresAt: new Date('2026-12-01T00:00:00Z'),
    });
    const found = await findCustomerSession('plain-h');
    expect(found?.customer.roleKey).toBe('customer');
    expect(found?.customer.permissions).toEqual([]);
  });
});

describe('auth rate limit repository', () => {
  it('hitRateLimit counts within a window and sweeps ended windows', async () => {
    const w1 = new Date('2026-11-10T10:00:00Z');
    const w2 = new Date('2026-11-10T11:00:00Z');
    expect(await hitRateLimit('sign-in:ip:1', w1, new Date('2026-11-10T00:00:00Z'))).toBe(1);
    expect(await hitRateLimit('sign-in:ip:1', w1, new Date('2026-11-10T00:00:00Z'))).toBe(2);
    expect(await hitRateLimit('sign-in:ip:2', w1, new Date('2026-11-10T00:00:00Z'))).toBe(1);
    expect(await hitRateLimit('sign-in:ip:1', w2, w2)).toBe(1);
    const rows = await client.query('SELECT window_start FROM auth_rate_limit');
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].window_start.toISOString()).toBe(w2.toISOString());
  });
});
