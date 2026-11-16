import { describe, expect, it, vi } from 'vitest';

import type { RoleKey } from '@/server/services/access/permission-keys';

import { createAccountRoleJobHandler } from './account-role-job-controller';

const SECRET = 'test-job-secret-0123456789abcdef-xyz';
const EMAIL = 'first.admin@example.com';

type Change = 'changed' | 'unchanged' | 'super_admin_exists' | 'unknown_account';

function setup(options: { account?: { id: string; roleKey: RoleKey } | null; change?: Change } = {}) {
  const account = options.account === undefined ? { id: 'acc-1', roleKey: 'customer' as RoleKey } : options.account;
  const findAccountByEmail = vi.fn(async (_email: string) => account);
  const changeAccountRole = vi.fn(async (_id: string, _role: RoleKey): Promise<Change> => options.change ?? 'changed');
  const log = vi.fn((_message: string) => undefined);
  const handler = createAccountRoleJobHandler({ jobSecret: () => SECRET, findAccountByEmail, changeAccountRole, log });
  const call = (body: unknown, authorization: string | null = `Bearer ${SECRET}`) =>
    handler(
      new Request('http://localhost:3000/api/jobs/account-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authorization === null ? {} : { Authorization: authorization }),
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );
  return { findAccountByEmail, changeAccountRole, log, call };
}

describe('createAccountRoleJobHandler', () => {
  it('answers 401 without the secret and touches nothing', async () => {
    const { call, findAccountByEmail, changeAccountRole } = setup();
    const response = await call({ email: EMAIL, role: 'super_admin' }, null);
    expect(response.status).toBe(401);
    expect(findAccountByEmail).not.toHaveBeenCalled();
    expect(changeAccountRole).not.toHaveBeenCalled();
  });

  it('answers 200 changed and normalises the email', async () => {
    const { call, findAccountByEmail, changeAccountRole } = setup();
    const response = await call({ email: `  ${EMAIL.toUpperCase()} `, role: 'super_admin' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ result: 'changed', role: 'super_admin' });
    expect(findAccountByEmail).toHaveBeenCalledWith(EMAIL);
    expect(changeAccountRole).toHaveBeenCalledWith('acc-1', 'super_admin');
  });

  it('answers 200 unchanged', async () => {
    const { call } = setup({ account: { id: 'acc-1', roleKey: 'super_admin' }, change: 'unchanged' });
    const response = await call({ email: EMAIL, role: 'super_admin' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'unchanged', role: 'super_admin' });
  });

  it('answers 404 for an unknown account', async () => {
    const { call, changeAccountRole } = setup({ account: null });
    const response = await call({ email: EMAIL, role: 'admin' });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'unknown_account' });
    expect(changeAccountRole).not.toHaveBeenCalled();
  });

  it('answers 404 when the account vanishes before the change', async () => {
    const { call } = setup({ change: 'unknown_account' });
    expect((await call({ email: EMAIL, role: 'admin' })).status).toBe(404);
  });

  it('answers 409 super_admin_exists when a Top-level Admin already exists', async () => {
    const { call } = setup({ account: { id: 'acc-1', roleKey: 'super_admin' }, change: 'super_admin_exists' });
    const response = await call({ email: EMAIL, role: 'customer' });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'super_admin_exists' });
  });

  it.each([
    ['guest', { email: EMAIL, role: 'guest' }],
    ['an unknown role', { email: EMAIL, role: 'owner' }],
    ['a bad email', { email: 'not-an-email', role: 'admin' }],
    ['a missing role', { email: EMAIL }],
    ['not JSON', '{nope'],
  ])('answers 400 for %s', async (_name, body) => {
    const { call, findAccountByEmail } = setup();
    const response = await call(body);
    expect(response.status).toBe(400);
    expect(findAccountByEmail).not.toHaveBeenCalled();
  });

  it('logs ids and roles and never the email', async () => {
    const { call, log } = setup();
    await call({ email: EMAIL, role: 'super_admin' });
    const text = log.mock.calls.map((c) => c[0]).join('\n');
    expect(text).toContain('acc-1');
    expect(text).toContain('customer');
    expect(text).toContain('super_admin');
    expect(text).not.toContain('example.com');
    expect(text.toLowerCase()).not.toContain('first.admin');
  });
});
