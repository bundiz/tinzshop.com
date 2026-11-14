import { describe, expect, it, vi } from 'vitest';

import type { CustomerAuthDeps } from '@/server/services/auth/customer-auth-service';
import { failedPasswordRules } from '@/server/services/auth/password-policy';

import {
  handleForgotPassword,
  handleRegister,
  handleResendCode,
  handleResendResetCode,
  handleResetPassword,
  handleSignIn,
  handleSignOut,
  handleVerify,
  PASSWORD_RESET_CODE_PATH,
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
    expect(out).toMatchObject({ state: { redirectTo: '/register/verify' }, cookies: { setPending: { email: 'ann@example.com', returnTo: '/', createdHere: true } } });
    expect(t.cognito.signUp).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'Passw0rd!', firstName: 'Ann', lastName: 'Lee' });
  });

  it('register with an email that already has an account is an email field error, keeps the names and sets no cookie (D-205)', async () => {
    const { CognitoError } = await import('@/server/adapters/cognito/errors');
    const t = build({ cognito: { signUp: vi.fn(async () => { throw new CognitoError('username_exists'); }) } });
    t.deps.customers.findByEmail = async () => ({ id: 'c1', cognitoSub: 's', email: 'ann@example.com', firstName: 'Ann', lastName: 'Lee' });
    const out = await handleRegister(t.deps, form(good), ctx());
    expect(out.state.fieldErrors).toEqual({ email: 'shop.auth.error.emailExists' });
    expect(out.state.values).toMatchObject({ email: 'Ann@Example.com', firstName: ' Ann ', lastName: 'Lee' });
    expect(out.state.redirectTo).toBeUndefined();
    expect(out.cookies).toBeUndefined();
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

  it('verify on an account created in this browser goes to sign-in', async () => {
    const t = build();
    const out = await handleVerify(t.deps, form({ code: '123456' }), ctx({ pendingEmail: 'ann@example.com', pendingCreatedHere: true }));
    // No session and no cookie change: the pending cookie stays so sign-in can prefill the email (R1, D-173).
    expect(out).toEqual({ state: { redirectTo: '/sign-in?confirmed=1' } });
    expect(t.cognito.forgotPassword).not.toHaveBeenCalled();
  });

  it('verify on an account not created here asks for a password with a second code', async () => {
    const t = build();
    const out = await handleVerify(
      t.deps,
      form({ code: '123456' }),
      ctx({ pendingEmail: 'ann@example.com', pendingCreatedHere: false, pendingReturnTo: '/product/abc/detail' }),
    );
    // The pending cookie is left as it is, so the reset step has the email and returnTo still reaches sign-in.
    expect(out).toEqual({ state: { redirectTo: `${PASSWORD_RESET_CODE_PATH}&setPassword=1` } });
    expect(t.cognito.confirmSignUp).toHaveBeenCalledWith({ email: 'ann@example.com', code: '123456' });
    expect(t.cognito.forgotPassword).toHaveBeenCalledWith({ email: 'ann@example.com' });
  });

  it('an old pending cookie without the flag is treated as not created here', async () => {
    const t = build();
    const out = await handleVerify(t.deps, form({ code: '123456' }), ctx({ pendingEmail: 'ann@example.com' }));
    expect(out.state.redirectTo).toBe(`${PASSWORD_RESET_CODE_PATH}&setPassword=1`);
  });

  it('a wrong code answers the same whether or not the account was created here', async () => {
    const { CognitoError } = await import('@/server/adapters/cognito/errors');
    const wrong = () => build({ cognito: { confirmSignUp: vi.fn(async () => { throw new CognitoError('code_mismatch'); }) } });
    const here = await handleVerify(wrong().deps, form({ code: '000000' }), ctx({ pendingEmail: 'ann@example.com', pendingCreatedHere: true }));
    const elsewhere = await handleVerify(wrong().deps, form({ code: '000000' }), ctx({ pendingEmail: 'ann@example.com', pendingCreatedHere: false }));
    expect(here).toEqual(elsewhere);
  });

  it('without the pending cookie it sends the customer back to register', async () => {
    const t = build();
    const out = await handleVerify(t.deps, form({ code: '123456' }), ctx());
    expect(out.state).toEqual({ redirectTo: '/register?expired=1' });
  });

  it('a confirmed account gets the same state and cookies as a wrong code', async () => {
    const { CognitoError } = await import('@/server/adapters/cognito/errors');
    const run = (code: 'already_confirmed' | 'code_mismatch') =>
      handleVerify(build({ cognito: { confirmSignUp: vi.fn(async () => { throw new CognitoError(code); }) } }).deps, form({ code: '000000' }), ctx({ pendingEmail: 'ann@example.com' }));
    const confirmed = await run('already_confirmed');
    expect(confirmed).toEqual(await run('code_mismatch'));
    expect(confirmed).toEqual({ state: { fieldErrors: { code: 'shop.auth.error.codeInvalid' } } });
  });

  it('reset step reachable from verify uses the pending email without sending a new code', async () => {
    expect(PASSWORD_RESET_CODE_PATH).toBe('/forgot-password?step=reset');
    const t = build();
    // The register-time pending cookie is all the reset step needs.
    const out = await handleResetPassword(
      t.deps,
      form({ code: '123456', password: 'N3wpass!x', passwordConfirm: 'N3wpass!x' }),
      ctx({ pendingEmail: 'ann@example.com' }),
    );
    expect(out.state).toEqual({ redirectTo: '/sign-in?reset=1' });
    expect(t.cognito.confirmForgotPassword).toHaveBeenCalledWith({ email: 'ann@example.com', code: '123456', newPassword: 'N3wpass!x' });
    expect(t.cognito.forgotPassword).not.toHaveBeenCalled();
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
    const out = await handleSignIn(t.deps, form({ email: 'Ann@Example.com', password: 'x', returnTo: '/product/abc/detail' }), ctx());
    expect(out).toEqual({
      state: { redirectTo: '/register/verify' },
      cookies: { setPending: { email: 'ann@example.com', returnTo: '/product/abc/detail', createdHere: true } },
    });
  });

  it('signing in while an older session cookie is present deletes that session', async () => {
    const t = build();
    const deleted: string[] = [];
    t.deps.session.sessions.delete = async (h) => {
      deleted.push(h);
    };
    const out = await handleSignIn(t.deps, form({ email: 'ann@example.com', password: 'x' }), ctx({ sessionToken: 'old-cookie' }));
    const { createHash } = await import('node:crypto');
    expect(deleted).toEqual([createHash('sha256').update('old-cookie').digest('hex')]);
    expect(out.cookies?.setSession?.token).not.toBe('old-cookie');
  });

  it('a wrong password is the invalidCredentials form error', async () => {
    const { CognitoError } = await import('@/server/adapters/cognito/errors');
    const t = build({ cognito: { signInWithPassword: vi.fn(async () => { throw new CognitoError('not_authorized'); }) } });
    const out = await handleSignIn(t.deps, form({ email: 'ann@example.com', password: 'x' }), ctx());
    expect(out.state).toEqual({ formError: 'shop.auth.error.invalidCredentials', values: { email: 'ann@example.com' } });
  });

  it('a malformed email on sign-in reads the same as a wrong password, before Cognito (D-207)', async () => {
    const t = build();
    const out = await handleSignIn(t.deps, form({ email: 'nope', password: 'x' }), ctx());
    expect(out.state).toEqual({ formError: 'shop.auth.error.invalidCredentials', values: { email: 'nope' } });
    expect(t.getCognito).not.toHaveBeenCalled();
  });

  it('a malformed email and no password on sign-in still asks for the password (D-207)', async () => {
    const t = build();
    const out = await handleSignIn(t.deps, form({ email: '', password: '' }), ctx());
    expect(out.state).toEqual({
      formError: 'shop.auth.error.invalidCredentials',
      fieldErrors: { password: 'shop.auth.error.passwordRequired' },
      values: { email: '' },
    });
  });

  it('resend gives a notice', async () => {
    const t = build();
    const out = await handleResendCode(t.deps, form({}), ctx({ pendingEmail: 'ann@example.com' }));
    expect(out.state).toEqual({ notice: 'shop.auth.verify.resent' });
  });

  it('forgot password moves to the reset step with the email pending', async () => {
    const t = build();
    const out = await handleForgotPassword(t.deps, form({ email: 'Ann@Example.com' }), ctx());
    // A redirect, so the code step survives a reload and shows without JavaScript (the cookie is set in the same response).
    expect(out).toEqual({
      state: { redirectTo: PASSWORD_RESET_CODE_PATH },
      cookies: { setPending: { email: 'ann@example.com', returnTo: '/', createdHere: false } },
    });
  });

  it('forgot password keeps the returnTo the sign-in page passed on, else the one already pending', async () => {
    const t = build();
    const fromLink = await handleForgotPassword(t.deps, form({ email: 'ann@example.com', returnTo: '/product/abc/detail' }), ctx());
    expect(fromLink.cookies?.setPending?.returnTo).toBe('/product/abc/detail');
    const unsafe = await handleForgotPassword(t.deps, form({ email: 'ann@example.com', returnTo: '//evil.test' }), ctx({ pendingReturnTo: '/product' }));
    expect(unsafe.cookies?.setPending?.returnTo).toBe('/');
    const pending = await handleForgotPassword(t.deps, form({ email: 'ann@example.com' }), ctx({ pendingReturnTo: '/product' }));
    expect(pending.cookies?.setPending?.returnTo).toBe('/product');
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

  it('reset and resend without a pending cookie go back to the first step', async () => {
    const t = build();
    const f = form({ code: '123456', password: 'N3wpass!x', passwordConfirm: 'N3wpass!x' });
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
    expect(out).toEqual({ state: { redirectTo: '/sign-in' }, cookies: { clearSession: true } });
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
    expect(await handleSignOut(t.deps, ctx())).toEqual({ state: { redirectTo: '/sign-in' }, cookies: { clearSession: true } });
  });
});

describe('returnTo through registration', () => {
  it('register with a returnTo keeps it in the pending cookie, and verify carries it to sign-in', async () => {
    const t = build();
    const registered = await handleRegister(t.deps, form({ ...good, returnTo: '/product/abc/detail' }), ctx());
    expect(registered.cookies?.setPending).toEqual({ email: 'ann@example.com', returnTo: '/product/abc/detail', createdHere: true });
    const verified = await handleVerify(
      t.deps,
      form({ code: '123456' }),
      ctx({ pendingEmail: 'ann@example.com', pendingReturnTo: '/product/abc/detail', pendingCreatedHere: true }),
    );
    expect(verified.state.redirectTo).toBe(`/sign-in?confirmed=1&returnTo=${encodeURIComponent('/product/abc/detail')}`);
  });

  it('an unsafe returnTo is dropped when writing and when reading', async () => {
    const t = build();
    const registered = await handleRegister(t.deps, form({ ...good, returnTo: '//evil.test' }), ctx());
    expect(registered.cookies?.setPending?.returnTo).toBe('/');
    const verified = await handleVerify(
      t.deps,
      form({ code: '123456' }),
      ctx({ pendingEmail: 'ann@example.com', pendingReturnTo: '//evil.test', pendingCreatedHere: true }),
    );
    expect(verified.state.redirectTo).toBe('/sign-in?confirmed=1');
  });

  it('a password reset also carries it to sign-in', async () => {
    const t = build();
    const out = await handleResetPassword(
      t.deps,
      form({ code: '123456', password: 'Passw0rd!', passwordConfirm: 'Passw0rd!' }),
      ctx({ pendingEmail: 'ann@example.com', pendingReturnTo: '/product' }),
    );
    expect(out.state.redirectTo).toBe(`/sign-in?reset=1&returnTo=${encodeURIComponent('/product')}`);
  });
});

describe('echoing values back to the form', () => {
  it('echoes the non-secret fields on an error, and never a password or code', async () => {
    const t = build({ count: 99 });
    const secrets = ['Passw0rd!', 'Sup3rSecret!x', '654321'];
    const outcomes = [
      await handleRegister(t.deps, form({ ...good, password: secrets[0]!, passwordConfirm: secrets[0]! }), ctx()),
      await handleRegister(build().deps, form({ ...good, password: 'weak', passwordConfirm: secrets[1]! }), ctx()),
      await handleSignIn(t.deps, form({ email: 'ann@example.com', password: secrets[1]! }), ctx()),
      await handleSignIn(build().deps, form({ email: 'ann@example.com', password: '' }), ctx()),
      await handleVerify(build().deps, form({ code: secrets[2]! }), ctx({ pendingEmail: 'ann@example.com' })),
      await handleVerify(build().deps, form({ code: '65' }), ctx({ pendingEmail: 'ann@example.com' })),
      await handleResetPassword(build().deps, form({ code: secrets[2]!, password: secrets[1]!, passwordConfirm: 'nope' }), ctx({ pendingEmail: 'ann@example.com' })),
    ];
    for (const outcome of outcomes) {
      const text = JSON.stringify(outcome.state);
      for (const secret of secrets) expect(text).not.toContain(secret);
    }
    expect(outcomes[0]!.state.values).toEqual({ firstName: ' Ann ', lastName: 'Lee', email: 'Ann@Example.com' });
    expect(outcomes[2]!.state.values).toEqual({ email: 'ann@example.com' });
    expect(outcomes[4]!.state.values).toBeUndefined();
    expect(outcomes[6]!.state.values).toBeUndefined();
    expect(Object.keys(outcomes[1]!.state.values ?? {}).sort()).toEqual(['email', 'firstName', 'lastName']);
  });

  it('echoes the email when forgot password is refused', async () => {
    const out = await handleForgotPassword(build({ count: 99 }).deps, form({ email: 'Ann@Example.com' }), ctx());
    expect(out.state.values).toEqual({ email: 'Ann@Example.com' });
  });
});

describe('the created-here flag (Q-061, D-186)', () => {
  it('the created-here flag is set only by a successful sign-up or an unconfirmed password sign-in', async () => {
    const { CognitoError } = await import('@/server/adapters/cognito/errors');
    const throwing = (code: 'username_exists' | 'user_not_confirmed' | 'not_authorized') =>
      vi.fn(async () => {
        throw new CognitoError(code);
      });

    const signedUp = await handleRegister(build().deps, form(good), ctx());
    expect(signedUp.cookies?.setPending?.createdHere).toBe(true);

    const taken = await handleRegister(build({ cognito: { signUp: throwing('username_exists') } }).deps, form(good), ctx());
    expect(taken.cookies?.setPending?.createdHere).toBe(false);
    // The visible answer is the same for both.
    expect(taken.state).toEqual(signedUp.state);

    const unconfirmed = await handleSignIn(
      build({ cognito: { signInWithPassword: throwing('user_not_confirmed') } }).deps,
      form({ email: 'ann@example.com', password: 'x' }),
      ctx(),
    );
    expect(unconfirmed.cookies?.setPending?.createdHere).toBe(true);

    const wrongPassword = await handleSignIn(
      build({ cognito: { signInWithPassword: throwing('not_authorized') } }).deps,
      form({ email: 'ann@example.com', password: 'x' }),
      ctx(),
    );
    expect(wrongPassword.cookies).toBeUndefined();

    const forgot = await handleForgotPassword(build().deps, form({ email: 'ann@example.com' }), ctx({ pendingCreatedHere: true }));
    expect(forgot.cookies?.setPending?.createdHere).toBe(false);

    // Resending touches no cookie, so it can never raise the flag.
    const resent = await handleResendCode(build().deps, form({}), ctx({ pendingEmail: 'ann@example.com', pendingCreatedHere: false }));
    expect(resent.cookies).toBeUndefined();
    const resentReset = await handleResendResetCode(build().deps, form({}), ctx({ pendingEmail: 'ann@example.com', pendingCreatedHere: false }));
    expect(resentReset.cookies).toBeUndefined();
  });
});

describe('send a new code from the reset step', () => {
  it('sends a reset code to the pending email and answers with a notice', async () => {
    const t = build();
    const out = await handleResendResetCode(t.deps, form({}), ctx({ pendingEmail: 'ann@example.com' }));
    expect(out).toEqual({ state: { notice: 'shop.auth.forgot.resent' } });
    expect(t.cognito.forgotPassword).toHaveBeenCalledWith({ email: 'ann@example.com' });
  });

  it('answers the same when Cognito refuses, so it reveals nothing', async () => {
    const { CognitoError } = await import('@/server/adapters/cognito/errors');
    for (const code of ['not_authorized', 'user_not_confirmed', 'limit_exceeded', 'unavailable'] as const) {
      const t = build({ cognito: { forgotPassword: vi.fn(async () => { throw new CognitoError(code); }) } });
      expect(await handleResendResetCode(t.deps, form({}), ctx({ pendingEmail: 'ann@example.com' })), code).toEqual({
        state: { notice: 'shop.auth.forgot.resent' },
      });
    }
  });

  it('counts against the forgot_password limit', async () => {
    const hits: string[] = [];
    const t = build({ count: 99 });
    t.deps.rateLimit = {
      hitRateLimit: async (k) => {
        hits.push(k);
        return 99;
      },
    };
    const out = await handleResendResetCode(t.deps, form({}), ctx({ pendingEmail: 'ann@example.com' }));
    expect(out.state.formError).toBe('shop.auth.error.rateLimited');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.startsWith('forgot_password:'))).toBe(true);
    expect(t.getCognito).not.toHaveBeenCalled();
  });

  it('without the pending cookie it goes back to the email step', async () => {
    const t = build();
    expect((await handleResendResetCode(t.deps, form({}), ctx())).state).toEqual({ redirectTo: '/forgot-password?expired=1' });
    expect(t.getCognito).not.toHaveBeenCalled();
  });
});
