import { describe, expect, it, vi } from 'vitest';

import type { CustomerAuthDeps } from '@/server/services/auth/customer-auth-service';
import { failedPasswordRules } from '@/server/services/auth/password-policy';

import {
  handleChoosePassword,
  handleForgotPassword,
  handleRegister,
  handleResendCode,
  handleResetPassword,
  handleSignIn,
  handleSignOut,
  handleVerify,
  type AuthRequestContext,
} from './customer-auth-controller';

const NOW = new Date('2026-11-10T00:00:00Z');
const ctx = (over: Partial<AuthRequestContext> = {}): AuthRequestContext => ({ ip: '203.0.113.9', now: NOW, pendingEmail: null, ...over });
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

function build(over: { cognito?: Record<string, unknown>; count?: number } = {}) {
  const cognito = {
    signUp: vi.fn(async () => undefined),
    confirmSignUp: vi.fn(async () => undefined),
    resendConfirmationCode: vi.fn(async () => undefined),
    forgotPassword: vi.fn(async () => undefined),
    confirmForgotPassword: vi.fn(async () => undefined),
    signInWithPassword: vi.fn(async () => ({ accessToken: 'A', idToken: 'I', refreshToken: 'R', accessExpiresAt: new Date(NOW.getTime() + 1e6) })),
    verifyIdToken: vi.fn(async () => ({ sub: 's', email: 'ann@example.com', givenName: 'Ann', familyName: null })),
    revokeRefreshToken: vi.fn(async () => undefined),
    ...over.cognito,
  };
  const getCognito = vi.fn(() => cognito as never);
  const deps: CustomerAuthDeps = {
    getCognito,
    rateLimit: { hitRateLimit: async () => over.count ?? 1 },
    customers: {
      upsertBySub: async () => ({ ok: true, customer: { id: 'c1', cognitoSub: 's', email: 'ann@example.com', firstName: 'Ann', lastName: null } }),
      findByEmail: async () => null,
    },
    session: {
      getCognito: () => cognito as never,
      getSessionKey: () => Buffer.alloc(32, 1),
      sessions: { insert: async () => undefined, find: async () => null, updateAccessToken: async () => undefined, delete: async () => undefined, deleteAll: async () => undefined },
    },
  };
  return { deps, cognito, getCognito };
}

const good = { firstName: ' Ann ', lastName: 'Lee', email: 'Ann@Example.com', password: 'Passw0rd!', passwordConfirm: 'Passw0rd!' };

describe('password policy (D-177)', () => {
  it.each([
    ['short1A!', []],
    ['Short1!', ['length']],
    ['nonumber!A', ['number']],
    ['NOLOWER1!', ['lowercase']],
    ['noupper1!', ['uppercase']],
    ['NoSpecial12', ['special']],
    ['Has Space1', []],
    [' Lead1Aaa', ['special']],
    ['Trail1Aaa ', ['special']],
  ])('%s fails %j', (password, failed) => {
    expect(failedPasswordRules(password)).toEqual(failed);
  });

  it('accepts each documented special character', () => {
    for (const ch of '^$*.[]{}()?-"!@#%&/\\,><\':;|_~`+=') expect(failedPasswordRules(`Abcdef1${ch}`)).toEqual([]);
  });
});

describe('register', () => {
  it('mismatched passwords are a field error and never reach Cognito', async () => {
    const t = build();
    const out = await handleRegister(t.deps, form({ ...good, passwordConfirm: 'Different1!' }), ctx());
    expect(out.state.fieldErrors).toEqual({ passwordConfirm: 'shop.auth.error.passwordMismatch' });
    expect(t.getCognito).not.toHaveBeenCalled();
  });

  it('a weak password and bad names are field errors', async () => {
    const t = build();
    const out = await handleRegister(t.deps, form({ ...good, firstName: '   ', lastName: 'x'.repeat(101), password: 'weak', passwordConfirm: 'weak' }), ctx());
    expect(out.state.fieldErrors).toMatchObject({
      firstName: 'shop.auth.error.nameRequired',
      lastName: 'shop.auth.error.nameTooLong',
      password: 'shop.auth.error.passwordPolicy',
    });
    expect(t.getCognito).not.toHaveBeenCalled();
  });

  it('success goes to verify and keeps the lowercased email in the pending cookie', async () => {
    const t = build();
    const out = await handleRegister(t.deps, form(good), ctx());
    expect(out).toEqual({ state: { redirectTo: '/register/verify' }, cookies: { setPending: { email: 'ann@example.com' } } });
    expect(t.cognito.signUp).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'Passw0rd!', firstName: 'Ann', lastName: 'Lee' });
  });

  it('a rate-limited register shows the rateLimited form error', async () => {
    const t = build({ count: 99 });
    const out = await handleRegister(t.deps, form(good), ctx());
    expect(out.state.formError).toBe('shop.auth.error.rateLimited');
    expect(t.getCognito).not.toHaveBeenCalled();
  });
});

describe('verify', () => {
  it('a code that is not 6 digits is a field error', async () => {
    const t = build();
    const out = await handleVerify(t.deps, form({ code: '12345' }), ctx({ pendingEmail: 'ann@example.com' }));
    expect(out.state.fieldErrors).toEqual({ code: 'shop.auth.error.codeFormat' });
    expect(t.getCognito).not.toHaveBeenCalled();
  });

  it('success goes to sign-in without a session', async () => {
    const t = build();
    const out = await handleVerify(t.deps, form({ code: '123456' }), ctx({ pendingEmail: 'ann@example.com' }));
    expect(out).toEqual({ state: { redirectTo: '/sign-in?confirmed=1' } });
  });

  it('without the pending cookie it sends the customer back to register', async () => {
    const t = build();
    const out = await handleVerify(t.deps, form({ code: '123456' }), ctx());
    expect(out.state).toEqual({ redirectTo: '/register?expired=1' });
  });

  it('a confirmed account switches to the choose-a-password step', async () => {
    const { CognitoError } = await import('@/server/adapters/cognito/errors');
    const t = build({ cognito: { confirmSignUp: vi.fn(async () => { throw new CognitoError('already_confirmed'); }) } });
    const out = await handleVerify(t.deps, form({ code: '123456' }), ctx({ pendingEmail: 'ann@example.com' }));
    expect(out.state).toEqual({ step: 'choose_password' });
  });

  it('choosing a password signs in, clears pending and honours a safe returnTo', async () => {
    const t = build();
    const out = await handleChoosePassword(
      t.deps,
      form({ code: '123456', password: 'N3wpass!x', passwordConfirm: 'N3wpass!x', returnTo: '//evil.example' }),
      ctx({ pendingEmail: 'ann@example.com' }),
    );
    expect(out.state.redirectTo).toBe('/');
    expect(out.cookies?.clearPending).toBe(true);
    expect(out.cookies?.setSession?.token).toBeTruthy();
  });

  it('choosing a mismatched password stays on the step', async () => {
    const t = build();
    const out = await handleChoosePassword(
      t.deps,
      form({ code: '123456', password: 'N3wpass!x', passwordConfirm: 'other' }),
      ctx({ pendingEmail: 'ann@example.com' }),
    );
    expect(out.state).toEqual({ fieldErrors: { passwordConfirm: 'shop.auth.error.passwordMismatch' }, step: 'choose_password' });
  });
});

describe('sign-in, resend, reset and sign-out', () => {
  it('sign-in sets the session cookie and redirects to the safe returnTo', async () => {
    const t = build();
    const out = await handleSignIn(t.deps, form({ email: 'Ann@Example.com', password: 'x', returnTo: '/product/12/detail' }), ctx());
    expect(out.state).toEqual({ redirectTo: '/product/12/detail' });
    expect(out.cookies?.setSession?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(out.cookies?.clearPending).toBe(true);
  });

  it('sign-in does not apply the password policy', async () => {
    const t = build();
    const out = await handleSignIn(t.deps, form({ email: 'ann@example.com', password: 'old' }), ctx());
    expect(out.state.fieldErrors).toBeUndefined();
  });

  it('an unconfirmed sign-in goes to verify with the email pending', async () => {
    const { CognitoError } = await import('@/server/adapters/cognito/errors');
    const t = build({ cognito: { signInWithPassword: vi.fn(async () => { throw new CognitoError('user_not_confirmed'); }) } });
    const out = await handleSignIn(t.deps, form({ email: 'Ann@Example.com', password: 'x' }), ctx());
    expect(out).toEqual({ state: { redirectTo: '/register/verify' }, cookies: { setPending: { email: 'ann@example.com' } } });
  });

  it('a wrong password is the invalidCredentials form error', async () => {
    const { CognitoError } = await import('@/server/adapters/cognito/errors');
    const t = build({ cognito: { signInWithPassword: vi.fn(async () => { throw new CognitoError('not_authorized'); }) } });
    const out = await handleSignIn(t.deps, form({ email: 'ann@example.com', password: 'x' }), ctx());
    expect(out.state).toEqual({ formError: 'shop.auth.error.invalidCredentials' });
  });

  it('resend gives a notice', async () => {
    const t = build();
    const out = await handleResendCode(t.deps, form({}), ctx({ pendingEmail: 'ann@example.com' }));
    expect(out.state).toEqual({ notice: 'shop.auth.verify.resent' });
  });

  it('forgot password moves to the reset step with the email pending', async () => {
    const t = build();
    const out = await handleForgotPassword(t.deps, form({ email: 'Ann@Example.com' }), ctx());
    expect(out).toEqual({ state: { step: 'reset' }, cookies: { setPending: { email: 'ann@example.com' } } });
  });

  it('forgot password rejects a malformed email before Cognito', async () => {
    const t = build();
    const out = await handleForgotPassword(t.deps, form({ email: 'nope' }), ctx());
    expect(out.state.fieldErrors).toEqual({ email: 'shop.auth.error.emailInvalid' });
    expect(t.getCognito).not.toHaveBeenCalled();
  });

  it('reset redirects to sign-in', async () => {
    const t = build();
    const out = await handleResetPassword(
      t.deps,
      form({ code: '123456', password: 'N3wpass!x', passwordConfirm: 'N3wpass!x' }),
      ctx({ pendingEmail: 'ann@example.com' }),
    );
    expect(out.state).toEqual({ redirectTo: '/sign-in?reset=1' });
  });

  it('sign-in with an unsafe returnTo lands on a safe path', async () => {
    for (const returnTo of ['//evil.example', '/\\evil.example', 'https://evil.example', '/th/product']) {
      const out = await handleSignIn(build().deps, form({ email: 'ann@example.com', password: 'x', returnTo }), ctx());
      expect(out.state.redirectTo).toBe('/');
    }
  });

  it('choose-password, reset and resend without a pending cookie go back to the first step', async () => {
    const t = build();
    const f = form({ code: '123456', password: 'N3wpass!x', passwordConfirm: 'N3wpass!x' });
    expect((await handleChoosePassword(t.deps, f, ctx())).state).toEqual({ redirectTo: '/register?expired=1' });
    expect((await handleResetPassword(t.deps, f, ctx())).state).toEqual({ redirectTo: '/forgot-password?expired=1' });
    expect((await handleResendCode(t.deps, f, ctx())).state).toEqual({ redirectTo: '/register?expired=1' });
    expect(t.getCognito).not.toHaveBeenCalled();
  });

  it('a password over 256 characters is refused before Cognito', async () => {
    const t = build();
    const long = `Aa1!${'x'.repeat(253)}`;
    const out = await handleRegister(t.deps, form({ ...good, password: long, passwordConfirm: long }), ctx());
    expect(out.state.fieldErrors).toEqual({ password: 'shop.auth.error.passwordPolicy' });
    expect(t.getCognito).not.toHaveBeenCalled();
  });

  it('sign-out with a token ends that session and clears the cookie', async () => {
    const deleted: string[] = [];
    const t = build();
    t.deps.session.sessions.delete = async (h) => {
      deleted.push(h);
    };
    const out = await handleSignOut(t.deps, ctx({ sessionToken: 'cookie-value' }));
    expect(deleted).toHaveLength(1);
    expect(out).toEqual({ state: { redirectTo: '/' }, cookies: { clearSession: true } });
  });

  it('sign-out still clears the cookie when ending the session fails, and logs without the token', async () => {
    const t = build();
    const logs: unknown[] = [];
    t.deps.log = (m, f) => logs.push({ m, f });
    t.deps.session.sessions.find = async () => {
      throw new Error('db down');
    };
    const out = await handleSignOut(t.deps, ctx({ sessionToken: 'cookie-value' }));
    expect(out.cookies).toEqual({ clearSession: true });
    expect(JSON.stringify(logs)).not.toContain('cookie-value');
    expect(logs).toHaveLength(1);
  });

  it('sign-out clears the cookie even with no session', async () => {
    const t = build();
    expect(await handleSignOut(t.deps, ctx())).toEqual({ state: { redirectTo: '/' }, cookies: { clearSession: true } });
  });
});
