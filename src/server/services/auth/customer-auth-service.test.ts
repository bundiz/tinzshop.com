import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { createCognitoIdentity } from '@/server/adapters/cognito/client';
import { CognitoError, type CognitoErrorCode } from '@/server/adapters/cognito/errors';
import type { CognitoIdentity } from './cognito-identity';
import {
  confirmPasswordReset,
  confirmRegistration,
  register,
  requestPasswordReset,
  resendCode,
  signIn,
  signOut,
  type CustomerAuthDeps,
} from './customer-auth-service';

const NOW = new Date('2026-11-10T00:00:00Z');
const key = randomBytes(32);
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const EXPIRES = new Date(NOW.getTime() + 900_000);
const TOKENS = { accessToken: 'A', idToken: 'I', refreshToken: 'R', accessExpiresAt: EXPIRES };

type Overrides = Partial<{ [K in keyof CognitoIdentity]: (...args: never[]) => unknown }>;

function build(opts: { cognito?: Overrides; rateLimitCount?: number; limitFor?: (key: string) => number; upsertEmailTaken?: boolean; existingCustomerId?: string | null } = {}) {
  const calls: Array<{ fn: string; input: unknown }> = [];
  const record = (fn: string, impl?: (input: never) => unknown) =>
    vi.fn(async (input: never) => {
      calls.push({ fn, input });
      return impl ? impl(input) : undefined;
    });
  const o = opts.cognito ?? {};
  const cognito = {
    signUp: record('signUp', o.signUp),
    confirmSignUp: record('confirmSignUp', o.confirmSignUp),
    resendConfirmationCode: record('resendConfirmationCode', o.resendConfirmationCode),
    signInWithPassword: record('signInWithPassword', o.signInWithPassword ?? (() => TOKENS)),
    forgotPassword: record('forgotPassword', o.forgotPassword),
    confirmForgotPassword: record('confirmForgotPassword', o.confirmForgotPassword),
    revokeRefreshToken: record('revokeRefreshToken', o.revokeRefreshToken),
    refresh: record('refresh'),
    verifyIdToken: record(
      'verifyIdToken',
      o.verifyIdToken ?? (() => ({ sub: 'sub-1', email: 'Ann@Example.com', givenName: 'Ann', familyName: 'Lee' })),
    ),
  };
  const getCognito = vi.fn(() => cognito as unknown as CognitoIdentity);
  const hits: string[] = [];
  const state = { inserted: [] as unknown[], deletedAll: [] as string[], deleted: [] as string[], upserts: [] as unknown[], logs: [] as unknown[] };
  const customer = { id: 'c1', cognitoSub: 'sub-1', email: 'ann@example.com', firstName: 'Ann', lastName: 'Lee' };
  const deps: CustomerAuthDeps = {
    getCognito,
    rateLimit: {
      hitRateLimit: async (k) => {
        hits.push(k);
        return opts.limitFor ? opts.limitFor(k) : (opts.rateLimitCount ?? 1);
      },
    },
    customers: {
      upsertBySub: async (input) => {
        state.upserts.push(input);
        return opts.upsertEmailTaken ? { ok: false, reason: 'email_taken' } : { ok: true, customer };
      },
      findByEmail: async () =>
        opts.existingCustomerId === null ? null : { ...customer, id: opts.existingCustomerId ?? 'c1' },
    },
    session: {
      getCognito: () => cognito as unknown as CognitoIdentity,
      getSessionKey: () => key,
      sessions: {
        insert: async (r) => {
          state.inserted.push(r);
        },
        find: async () => null,
        updateAccessToken: async () => undefined,
        delete: async (h) => {
          state.deleted.push(h);
        },
        deleteAll: async (id) => {
          state.deletedAll.push(id);
        },
      },
    },
    log: (message, fields) => {
      state.logs.push({ message, fields });
    },
  };
  return { deps, calls, state, getCognito, hits, cognito };
}

const fail = (code: CognitoErrorCode) => () => {
  throw new CognitoError(code);
};
const base = { ip: '203.0.113.9', now: NOW };
const reg = { ...base, email: 'Ann@Example.com', password: 'Passw0rd!', firstName: 'Ann', lastName: 'Lee' };

describe('register', () => {
  it('register with a new email signs up and goes to verify', async () => {
    const t = build();
    expect(await register(t.deps, reg)).toEqual({ ok: true, data: { next: 'verify' } });
    expect(t.calls.map((c) => c.fn)).toEqual(['signUp']);
  });

  it('register with a taken email shows the same verify step and starts a reset', async () => {
    const t = build({ cognito: { signUp: fail('username_exists') } });
    expect(await register(t.deps, reg)).toEqual({ ok: true, data: { next: 'verify' } });
    expect(t.calls.map((c) => c.fn)).toEqual(['signUp', 'forgotPassword']);
  });

  it('register with a never-confirmed email resends the sign-up code', async () => {
    const t = build({ cognito: { signUp: fail('username_exists'), forgotPassword: fail('user_not_confirmed') } });
    expect(await register(t.deps, reg)).toEqual({ ok: true, data: { next: 'verify' } });
    expect(t.calls.map((c) => c.fn)).toEqual(['signUp', 'forgotPassword', 'resendConfirmationCode']);
  });

  it.each(['code_mismatch', 'code_expired', 'already_confirmed', 'not_authorized', 'invalid_password', 'limit_exceeded', 'unavailable'] as const)(
    'register answers the same when the reset step fails with %s',
    async (code) => {
      const t = build({ cognito: { signUp: fail('username_exists'), forgotPassword: fail(code) } });
      expect(await register(t.deps, reg)).toEqual({ ok: true, data: { next: 'verify' } });
      const logged = JSON.stringify(t.state.logs);
      expect(logged).not.toContain('example.com');
    },
  );

  it.each(['unavailable', 'not_authorized', 'invalid_password', 'code_mismatch'] as const)(
    'register resends the sign-up code when the reset fails with %s',
    async (code) => {
      const t = build({ cognito: { signUp: fail('username_exists'), forgotPassword: fail(code) } });
      expect(await register(t.deps, reg)).toEqual({ ok: true, data: { next: 'verify' } });
      expect(t.calls.map((c) => c.fn)).toEqual(['signUp', 'forgotPassword', 'resendConfirmationCode']);
    },
  );

  it('register does not resend when the reset is throttled', async () => {
    const t = build({ cognito: { signUp: fail('username_exists'), forgotPassword: fail('limit_exceeded') } });
    expect(await register(t.deps, reg)).toEqual({ ok: true, data: { next: 'verify' } });
    expect(t.calls.map((c) => c.fn)).toEqual(['signUp', 'forgotPassword']);
  });

  it('register answers the same when resending for a never-confirmed account fails', async () => {
    const t = build({
      cognito: { signUp: fail('username_exists'), forgotPassword: fail('user_not_confirmed'), resendConfirmationCode: fail('unavailable') },
    });
    expect(await register(t.deps, reg)).toEqual({ ok: true, data: { next: 'verify' } });
  });

  it('a mixed-case email reaches Cognito lowercased', async () => {
    const t = build({ cognito: { signUp: fail('username_exists') } });
    await register(t.deps, reg);
    const emails = t.calls.map((c) => (c.input as { email: string }).email);
    expect(emails).toEqual(['ann@example.com', 'ann@example.com']);
    expect(t.hits).toContain(`register:email:${sha('ann@example.com')}`);
  });

  it('register maps a pool password refusal to a password field error', async () => {
    const t = build({ cognito: { signUp: fail('invalid_password') } });
    const result = await register(t.deps, reg);
    expect(result).toMatchObject({ ok: false, error: { code: 'auth.invalid_password', messageKey: 'shop.auth.error.passwordPolicy', details: { field: 'password' } } });
  });

  it('register when Cognito is unavailable asks to try again', async () => {
    const t = build({ cognito: { signUp: fail('unavailable') } });
    expect(await register(t.deps, reg)).toMatchObject({ ok: false, error: { messageKey: 'shop.auth.error.unavailable' } });
  });
});

describe('non-Cognito errors surface (D-022)', () => {
  const bug = () => {
    throw new TypeError('boom');
  };
  it('register rethrows a bug from signUp and from the follow-up steps', async () => {
    await expect(register(build({ cognito: { signUp: bug } }).deps, reg)).rejects.toThrow('boom');
    await expect(register(build({ cognito: { signUp: fail('username_exists'), forgotPassword: bug } }).deps, reg)).rejects.toThrow('boom');
  });
  it('confirmRegistration and confirmPasswordReset rethrow a bug', async () => {
    await expect(confirmRegistration(build({ cognito: { confirmSignUp: bug } }).deps, { ...base, email: 'a@example.com', code: '123456' })).rejects.toThrow('boom');
    const pw = { ...base, email: 'a@example.com', code: '123456', newPassword: 'N3wpass!x' };
    await expect(confirmPasswordReset(build({ cognito: { confirmForgotPassword: bug } }).deps, pw)).rejects.toThrow('boom');
  });
  it('signIn, resendCode and requestPasswordReset rethrow a bug', async () => {
    await expect(signIn(build({ cognito: { signInWithPassword: bug } }).deps, { ...base, email: 'a@example.com', password: 'x' })).rejects.toThrow('boom');
    await expect(signIn(build({ cognito: { verifyIdToken: bug } }).deps, { ...base, email: 'a@example.com', password: 'x' })).rejects.toThrow('boom');
    await expect(resendCode(build({ cognito: { resendConfirmationCode: bug } }).deps, { ...base, email: 'a@example.com' })).rejects.toThrow('boom');
    await expect(requestPasswordReset(build({ cognito: { forgotPassword: bug } }).deps, { ...base, email: 'a@example.com' })).rejects.toThrow('boom');
  });
});

describe('confirmRegistration', () => {
  const input = { ...base, email: 'Ann@Example.com', code: '123456' };

  it('a correct code goes to sign-in without signing in', async () => {
    const t = build();
    expect(await confirmRegistration(t.deps, input)).toEqual({ ok: true, data: { next: 'sign_in' } });
    expect(t.calls.map((c) => c.fn)).toEqual(['confirmSignUp']);
  });

  it('verify with any code on a confirmed account answers like a wrong code', async () => {
    const confirmed = build({ cognito: { confirmSignUp: fail('already_confirmed') } });
    const wrong = build({ cognito: { confirmSignUp: fail('code_mismatch') } });
    const a = await confirmRegistration(confirmed.deps, input);
    const b = await confirmRegistration(wrong.deps, input);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ ok: false, error: { messageKey: 'shop.auth.error.codeInvalid', details: { field: 'code' } } });
  });

  it('a wrong code is a code field error', async () => {
    const t = build({ cognito: { confirmSignUp: fail('code_mismatch') } });
    expect(await confirmRegistration(t.deps, input)).toMatchObject({
      ok: false,
      error: { code: 'auth.invalid_code', messageKey: 'shop.auth.error.codeInvalid', details: { field: 'code' } },
    });
  });

  it('an expired code says so', async () => {
    const t = build({ cognito: { confirmSignUp: fail('code_expired') } });
    expect(await confirmRegistration(t.deps, input)).toMatchObject({ ok: false, error: { messageKey: 'shop.auth.error.codeExpired' } });
  });

  it('an unknown email answers like a wrong code', async () => {
    const t = build({ cognito: { confirmSignUp: fail('not_authorized') } });
    expect(await confirmRegistration(t.deps, input)).toMatchObject({ ok: false, error: { messageKey: 'shop.auth.error.codeInvalid' } });
  });
});

describe('resendCode', () => {
  it('resends the sign-up code', async () => {
    const t = build();
    expect(await resendCode(t.deps, { ...base, email: 'Ann@Example.com' })).toEqual({ ok: true, data: { next: 'verify' } });
    expect(t.calls.map((c) => c.fn)).toEqual(['resendConfirmationCode']);
  });

  it('falls back to a reset code for a confirmed account and never reveals failures', async () => {
    const t = build({ cognito: { resendConfirmationCode: fail('already_confirmed'), forgotPassword: fail('unavailable') } });
    expect(await resendCode(t.deps, { ...base, email: 'ann@example.com' })).toEqual({ ok: true, data: { next: 'verify' } });
    expect(t.calls.map((c) => c.fn)).toEqual(['resendConfirmationCode', 'forgotPassword']);
  });
});

describe('signIn', () => {
  const input = { ...base, email: 'Ann@Example.com', password: 'Passw0rd!' };

  it('sign-in upserts the customer by sub with lowercased email', async () => {
    const t = build();
    const result = await signIn(t.deps, input);
    expect(result.ok).toBe(true);
    expect(t.calls[0]).toEqual({ fn: 'signInWithPassword', input: { email: 'ann@example.com', password: 'Passw0rd!' } });
    expect(t.state.upserts).toEqual([{ sub: 'sub-1', email: 'ann@example.com', firstName: 'Ann', lastName: 'Lee' }]);
    expect(t.state.inserted).toHaveLength(1);
    if (result.ok && result.data.next === 'done') expect(result.data.customer.id).toBe('c1');
  });

  it('wrong password and unknown email give the same error', async () => {
    // Two different Cognito exceptions, mapped by the real adapter, as the pool answers them.
    const viaAdapter = (exceptionName: string) => {
      const identity = createCognitoIdentity(
        { region: 'r', userPoolId: 'p', clientId: 'c', clientSecret: 's', domain: 'd.example.com' },
        {
          send: async () => {
            throw Object.assign(new Error('x'), { name: exceptionName });
          },
        },
      );
      const t = build();
      return { ...t.deps, getCognito: () => identity } satisfies CustomerAuthDeps;
    };
    const a = await signIn(viaAdapter('NotAuthorizedException'), input);
    const b = await signIn(viaAdapter('UserNotFoundException'), { ...input, email: 'nobody@example.com' });
    expect(a).toEqual(b);
    expect(a).toMatchObject({ ok: false, error: { code: 'auth.invalid_credentials', messageKey: 'shop.auth.error.invalidCredentials' } });
  });

  it('unconfirmed sign-in goes to verify', async () => {
    const t = build({ cognito: { signInWithPassword: fail('user_not_confirmed') } });
    expect(await signIn(t.deps, input)).toEqual({ ok: true, data: { next: 'verify' } });
    expect(t.calls.map((c) => c.fn)).toEqual(['signInWithPassword', 'resendConfirmationCode']);
  });

  it('a sub that cannot take the email is refused without a session', async () => {
    const t = build({ upsertEmailTaken: true });
    expect(await signIn(t.deps, input)).toMatchObject({ ok: false, error: { messageKey: 'shop.auth.error.accountConflict' } });
    expect(t.state.inserted).toHaveLength(0);
  });

  it('a refused email revokes the refresh token it just received', async () => {
    const t = build({ upsertEmailTaken: true });
    await signIn(t.deps, input);
    expect(t.calls.filter((c) => c.fn === 'revokeRefreshToken')).toEqual([{ fn: 'revokeRefreshToken', input: 'R' }]);
  });

  it('a failed revoke does not change the answer', async () => {
    const t = build({ upsertEmailTaken: true, cognito: { revokeRefreshToken: fail('unavailable') } });
    expect(await signIn(t.deps, input)).toMatchObject({ ok: false, error: { messageKey: 'shop.auth.error.accountConflict' } });
  });

  it('the unconfirmed sign-in resend passes the resend rate limit', async () => {
    const t = build({ cognito: { signInWithPassword: fail('user_not_confirmed') } });
    await signIn(t.deps, input);
    expect(t.hits.some((h) => h.startsWith('resend:email:'))).toBe(true);
  });

  it('the unconfirmed sign-in does not resend once the resend limit is hit, but still goes to verify', async () => {
    const t = build({ cognito: { signInWithPassword: fail('user_not_confirmed') }, limitFor: (k) => (k.startsWith('resend:') ? 99 : 1) });
    expect(await signIn(t.deps, input)).toEqual({ ok: true, data: { next: 'verify' } });
    expect(t.calls.map((c) => c.fn)).toEqual(['signInWithPassword']);
  });

  it('Cognito unavailable asks to try again', async () => {
    const t = build({ cognito: { signInWithPassword: fail('unavailable') } });
    expect(await signIn(t.deps, input)).toMatchObject({ ok: false, error: { messageKey: 'shop.auth.error.unavailable' } });
  });
});

describe('password reset', () => {
  it('forgot password answers the same for unknown emails', async () => {
    const known = build();
    const results = [await requestPasswordReset(known.deps, { ...base, email: 'ann@example.com' })];
    for (const code of ['not_authorized', 'user_not_confirmed', 'invalid_password', 'limit_exceeded', 'unavailable'] as const) {
      const t = build({ cognito: { forgotPassword: fail(code) } });
      results.push(await requestPasswordReset(t.deps, { ...base, email: 'nobody@example.com' }));
    }
    for (const r of results) expect(r).toEqual({ ok: true, data: { next: 'reset' } });
  });

  it('password reset ends every session of that customer', async () => {
    const t = build();
    const result = await confirmPasswordReset(t.deps, { ...base, email: 'Ann@Example.com', code: '123456', newPassword: 'N3wpass!x' });
    expect(result).toEqual({ ok: true, data: { next: 'sign_in' } });
    expect(t.calls[0]).toEqual({ fn: 'confirmForgotPassword', input: { email: 'ann@example.com', code: '123456', newPassword: 'N3wpass!x' } });
    expect(t.state.deletedAll).toEqual(['c1']);
  });

  it('a customer who never signed in on the site has no sessions to end', async () => {
    const t = build({ existingCustomerId: null });
    expect(await confirmPasswordReset(t.deps, { ...base, email: 'ann@example.com', code: '123456', newPassword: 'N3wpass!x' })).toEqual({
      ok: true,
      data: { next: 'sign_in' },
    });
    expect(t.state.deletedAll).toEqual([]);
  });

  it('reset step answers the same for wrong code, unconfirmed and unknown user', async () => {
    const input = { ...base, email: 'ann@example.com', code: '123456', newPassword: 'N3wpass!x' };
    const results = [];
    for (const code of ['code_mismatch', 'user_not_confirmed', 'not_authorized', 'already_confirmed', 'unavailable'] as const) {
      const t = build({ cognito: { confirmForgotPassword: fail(code) } });
      results.push(await confirmPasswordReset(t.deps, input));
      expect(t.state.deletedAll).toEqual([]);
    }
    for (const r of results) {
      expect(r).toEqual(results[0]);
    }
    expect(results[0]).toMatchObject({ ok: false, error: { messageKey: 'shop.auth.error.codeInvalid', details: { field: 'code' } } });
  });

  it('reset keeps its own answers for an expired code, a throttle and a refused password', async () => {
    const input = { ...base, email: 'ann@example.com', code: '123456', newPassword: 'N3wpass!x' };
    const key = async (code: CognitoErrorCode) =>
      confirmPasswordReset(build({ cognito: { confirmForgotPassword: fail(code) } }).deps, input);
    expect(await key('code_expired')).toMatchObject({ error: { messageKey: 'shop.auth.error.codeExpired' } });
    expect(await key('limit_exceeded')).toMatchObject({ error: { messageKey: 'shop.auth.error.rateLimited' } });
    expect(await key('invalid_password')).toMatchObject({ error: { messageKey: 'shop.auth.error.passwordPolicy' } });
  });

  it('a wrong reset code changes nothing', async () => {
    const t = build({ cognito: { confirmForgotPassword: fail('code_mismatch') } });
    expect(await confirmPasswordReset(t.deps, { ...base, email: 'ann@example.com', code: '123456', newPassword: 'N3wpass!x' })).toMatchObject({
      ok: false,
      error: { messageKey: 'shop.auth.error.codeInvalid' },
    });
    expect(t.state.deletedAll).toEqual([]);
  });
});

describe('rate limits', () => {
  it.each([
    ['register', (d: CustomerAuthDeps) => register(d, reg)],
    ['verify', (d: CustomerAuthDeps) => confirmRegistration(d, { ...base, email: 'a@example.com', code: '123456' })],
    ['verify', (d: CustomerAuthDeps) => confirmPasswordReset(d, { ...base, email: 'a@example.com', code: '123456', newPassword: 'N3wpass!x' })],
    ['resend', (d: CustomerAuthDeps) => resendCode(d, { ...base, email: 'a@example.com' })],
    ['sign_in', (d: CustomerAuthDeps) => signIn(d, { ...base, email: 'a@example.com', password: 'x' })],
    ['forgot_password', (d: CustomerAuthDeps) => requestPasswordReset(d, { ...base, email: 'a@example.com' })],
  ] as const)('rate-limited action returns rateLimited before calling Cognito (%s)', async (action, run) => {
    const t = build({ rateLimitCount: 99 });
    const result = await run(t.deps);
    expect(result).toMatchObject({ ok: false, error: { code: 'auth.rate_limited', messageKey: 'shop.auth.error.rateLimited' } });
    expect(t.getCognito).not.toHaveBeenCalled();
    expect(t.calls).toEqual([]);
    expect(t.hits.every((h) => h.startsWith(`${action}:`))).toBe(true);
  });
});

describe('signOut', () => {
  it('ends this device only and is not rate limited', async () => {
    const t = build({ rateLimitCount: 99 });
    expect(await signOut(t.deps, { token: 'cookie-value' })).toEqual({ ok: true, data: { next: 'signed_out' } });
    expect(t.hits).toEqual([]);
    expect(t.state.deleted).toEqual([sha('cookie-value')]);
    expect(t.state.deletedAll).toEqual([]);
  });
});
