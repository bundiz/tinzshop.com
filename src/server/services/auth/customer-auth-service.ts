import { createHash } from 'node:crypto';

import type { Result, DomainError } from '@/server/services/shared/result';

import { isCognitoError, type CognitoFailureCode, type CognitoIdentity, type CognitoTokens } from './cognito-identity';
import {
  endAllCustomerSessions,
  endCustomerSession,
  startCustomerSession,
  type CustomerSessionDeps,
} from './customer-session-service';
import { checkAuthRateLimit, type AuthRateLimitAction, type AuthRateLimitDeps } from './rate-limit-service';

type CustomerIdentityRecord = { id: string; cognitoSub: string; email: string; firstName: string; lastName: string | null };

export type CustomerAuthDeps = {
  /** Called only after the rate-limit check passes, so a refused request never reads Cognito config. */
  getCognito(): CognitoIdentity;
  rateLimit: AuthRateLimitDeps;
  customers: {
    upsertBySub(input: {
      sub: string;
      email: string;
      firstName: string;
      lastName: string | null;
    }): Promise<{ ok: true; customer: CustomerIdentityRecord } | { ok: false; reason: 'email_taken' }>;
    findByEmail(email: string): Promise<CustomerIdentityRecord | null>;
  };
  session: CustomerSessionDeps;
  /** Receives a message and ids/codes only: never an email, password, code or token. */
  log?: (message: string, fields: { emailHash?: string; customerId?: string; code?: string }) => void;
};

type Base = { ip: string | null; now: Date };

export type SignedIn = {
  customer: { id: string; firstName: string };
  session: { token: string; expiresAt: Date };
};

const error = (code: string, message: string, messageKey: string, details?: unknown): { ok: false; error: DomainError } => ({
  ok: false,
  error: details === undefined ? { code, message, messageKey } : { code, message, messageKey, details },
});

const unavailable = () => error('auth.unavailable', 'The identity service is unavailable', 'shop.auth.error.unavailable');
const invalidCode = () =>
  error('auth.invalid_code', 'The verification code is wrong', 'shop.auth.error.codeInvalid', { field: 'code' });
const expiredCode = () =>
  error('auth.code_expired', 'The verification code has expired', 'shop.auth.error.codeExpired', { field: 'code' });
const invalidPassword = () =>
  error('auth.invalid_password', 'The password does not meet the policy', 'shop.auth.error.passwordPolicy', { field: 'password' });
const tooMany = () => error('auth.rate_limited', 'Too many attempts', 'shop.auth.error.rateLimited');

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailHash(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

/** The Cognito failure code. A non-Cognito error is a bug: it is rethrown with its stack (D-022). */
function codeOf(e: unknown): CognitoFailureCode {
  if (isCognitoError(e)) return e.code;
  throw e;
}

/** Counts the attempt first, on the lowercased email. Returns the email to use, or the refusal. */
async function gate(
  deps: CustomerAuthDeps,
  action: AuthRateLimitAction,
  input: Base & { email: string },
): Promise<{ email: string } | { refusal: { ok: false; error: DomainError } }> {
  const email = normaliseEmail(input.email);
  const limit = await checkAuthRateLimit(deps.rateLimit, action, { ip: input.ip, email, now: input.now });
  return limit.ok ? { email } : { refusal: tooMany() };
}

/** Runs a Cognito step whose failure must not change the answer; logs the code, never the email. */
async function quietly(deps: CustomerAuthDeps, label: string, email: string, step: () => Promise<void>): Promise<string | null> {
  try {
    await step();
    return null;
  } catch (e) {
    const code = codeOf(e);
    deps.log?.(`${label} failed`, { emailHash: emailHash(email), code });
    return code;
  }
}

/** Maps a failed code check (confirm sign-up or confirm forgot password) to our own answers. */
function codeFailure(e: unknown): { ok: false; error: DomainError } {
  switch (codeOf(e)) {
    case 'code_expired':
      return expiredCode();
    case 'invalid_password':
      return invalidPassword();
    case 'limit_exceeded':
      return tooMany();
    case 'unavailable':
      return unavailable();
    default:
      // code_mismatch, and not_authorized for an unknown email: the same answer, so nothing is revealed.
      return invalidCode();
  }
}

/**
 * Registers. Always continues to the verify step, whoever owns the email (O-9): a taken email starts
 * a password reset, a never-confirmed one gets its sign-up code again, and any failure of those
 * follow-up steps is logged by code and changes nothing the caller can see.
 *
 * `createdHere` is true only when this `SignUp` made a new account (Q-061, D-186). It goes into the sealed
 * pending cookie, never onto the page, so the answer still looks the same whoever owns the email.
 */
export async function register(
  deps: CustomerAuthDeps,
  input: Base & { email: string; password: string; firstName: string; lastName: string },
): Promise<Result<{ next: 'verify'; createdHere: boolean }>> {
  const gated = await gate(deps, 'register', input);
  if ('refusal' in gated) return gated.refusal;
  const { email } = gated;
  const cognito = deps.getCognito();
  try {
    await cognito.signUp({ email, password: input.password, firstName: input.firstName, lastName: input.lastName });
    return { ok: true, data: { next: 'verify', createdHere: true } };
  } catch (e) {
    const code = codeOf(e);
    if (code === 'invalid_password') return invalidPassword();
    if (code === 'limit_exceeded') return tooMany();
    if (code !== 'username_exists') {
      deps.log?.('register failed', { emailHash: emailHash(email), code });
      return unavailable();
    }
  }
  // A customer row exists only for an account that has signed in, so it is confirmed: say the email has an account
  // and send nothing (D-225). The pool hides confirmation status, so an account confirmed but never signed in has no
  // row and still takes the verify path below.
  if ((await deps.customers.findByEmail(email)) !== null) {
    return error('auth.email_exists', 'An account already holds this email', 'shop.auth.error.emailExists', { field: 'email' });
  }
  const resetFailure = await quietly(deps, 'register reset', email, () => cognito.forgotPassword({ email }));
  // A never-confirmed account may answer ForgotPassword in several ways, so any failure but a throttle resends.
  if (resetFailure !== null && resetFailure !== 'limit_exceeded') {
    await quietly(deps, 'register resend', email, () => cognito.resendConfirmationCode({ email }));
  }
  return { ok: true, data: { next: 'verify', createdHere: false } };
}

/**
 * Confirms the sign-up code. A confirmed account answers exactly like a wrong code (Q-060, D-179), so
 * a stranger cannot learn that an email has an account.
 *
 * After a correct code (Q-061, D-186): an account this browser created (`createdHere`) goes to sign-in. Any
 * other account may carry a password somebody else chose, so a second code is sent (`ForgotPassword`, which
 * works now the email is verified) and the customer sets their own password with it; that reset ends every
 * session. A failed second code still goes to the reset step, which offers to send a new one.
 */
export async function confirmRegistration(
  deps: CustomerAuthDeps,
  input: Base & { email: string; code: string; createdHere: boolean },
): Promise<Result<{ next: 'sign_in' } | { next: 'set_password' }>> {
  const gated = await gate(deps, 'verify', input);
  if ('refusal' in gated) return gated.refusal;
  const cognito = deps.getCognito();
  try {
    await cognito.confirmSignUp({ email: gated.email, code: input.code });
  } catch (e) {
    return codeFailure(e);
  }
  if (input.createdHere) return { ok: true, data: { next: 'sign_in' } };
  await quietly(deps, 'second code after verify', gated.email, () => cognito.forgotPassword({ email: gated.email }));
  return { ok: true, data: { next: 'set_password' } };
}

async function endSessionsFor(deps: CustomerAuthDeps, email: string): Promise<void> {
  const existing = await deps.customers.findByEmail(email);
  if (existing !== null) await endAllCustomerSessions(deps.session, existing.id);
}

/**
 * Turns Cognito tokens into an upserted customer and a started session. Password sign-in and Google
 * sign-in both end here. When another `sub` holds the email, no session is started and the refresh
 * token is revoked so no live token is left behind; the log carries the email hash only.
 *
 * `previousToken` is the session cookie the browser already held: that session is ended (row deleted,
 * refresh token revoked) before the new one starts, so a sign-in never leaves an orphaned row. A
 * started session is logged with the customer id only (spec §7).
 */
export async function startSessionFromTokens(
  deps: CustomerAuthDeps,
  cognito: CognitoIdentity,
  input: { tokens: CognitoTokens; now: Date; previousToken?: string | undefined },
): Promise<SignedIn | 'email_taken'> {
  const { tokens } = input;
  const identity = await cognito.verifyIdToken(tokens.idToken);
  // Cognito stores native emails lowercased (we lowercase them); lowercase anyway before the upsert.
  const identityEmail = normaliseEmail(identity.email);
  const upsert = await deps.customers.upsertBySub({
    sub: identity.sub,
    email: identityEmail,
    firstName: identity.givenName ?? identityEmail.split('@')[0] ?? identityEmail,
    lastName: identity.familyName,
  });
  if (!upsert.ok) {
    deps.log?.('sign-in refused: email held by another account', { emailHash: emailHash(identityEmail), code: 'email_taken' });
    await quietly(deps, 'revoke after refused sign-in', identityEmail, () => cognito.revokeRefreshToken(tokens.refreshToken));
    return 'email_taken';
  }
  if (input.previousToken !== undefined && input.previousToken !== '') {
    await endCustomerSession(deps.session, input.previousToken);
  }
  const session = await startCustomerSession(deps.session, { customerId: upsert.customer.id, tokens, now: input.now });
  deps.log?.('customer signed in', { customerId: upsert.customer.id });
  return { customer: { id: upsert.customer.id, firstName: upsert.customer.firstName }, session };
}

/** Signs in with a password the request holds, and starts the session.  */
async function signInAndStart(
  deps: CustomerAuthDeps,
  cognito: CognitoIdentity,
  input: { email: string; password: string; now: Date; previousToken?: string | undefined },
): Promise<SignedIn | 'email_taken'> {
  const tokens = await cognito.signInWithPassword({ email: input.email, password: input.password });
  return startSessionFromTokens(deps, cognito, { tokens, now: input.now, previousToken: input.previousToken });
}

const accountConflict = () =>
  error('auth.account_conflict', 'Another account already holds this email', 'shop.auth.error.accountConflict');

/** Sends a new code: the sign-up code, or a reset code when the account is already confirmed. Always answers the same. */
export async function resendCode(deps: CustomerAuthDeps, input: Base & { email: string }): Promise<Result<{ next: 'verify' }>> {
  const gated = await gate(deps, 'resend', input);
  if ('refusal' in gated) return gated.refusal;
  const { email } = gated;
  const cognito = deps.getCognito();
  const failure = await quietly(deps, 'resend', email, () => cognito.resendConfirmationCode({ email }));
  if (failure !== null) {
    await quietly(deps, 'resend reset', email, () => cognito.forgotPassword({ email }));
  }
  return { ok: true, data: { next: 'verify' } };
}

/**
 * Email and password sign-in. A wrong password and an unknown email give the same answer. `previousToken` is
 * the session cookie already in the browser, ended before the new session starts.
 */
export async function signIn(
  deps: CustomerAuthDeps,
  input: Base & { email: string; password: string; previousToken?: string | undefined },
): Promise<Result<({ next: 'done' } & SignedIn) | { next: 'verify'; createdHere: true }>> {
  const gated = await gate(deps, 'sign_in', input);
  if ('refusal' in gated) return gated.refusal;
  const { email } = gated;
  const cognito = deps.getCognito();
  try {
    const signedIn = await signInAndStart(deps, cognito, { email, password: input.password, now: input.now, previousToken: input.previousToken });
    if (signedIn === 'email_taken') return accountConflict();
    return { ok: true, data: { next: 'done', ...signedIn } };
  } catch (e) {
    const code = codeOf(e);
    if (code === 'not_authorized' || code === 'user_not_confirmed') {
      deps.log?.('password sign-in failed', { emailHash: emailHash(email), code });
    }
    if (code === 'user_not_confirmed') {
      // The resend counts against the resend limit like any other; over it, the customer still goes to verify.
      const allowed = await checkAuthRateLimit(deps.rateLimit, 'resend', { ip: input.ip, email, now: input.now });
      if (allowed.ok) await quietly(deps, 'sign-in resend', email, () => cognito.resendConfirmationCode({ email }));
      // Cognito answers "not confirmed" only once the password is right, so this browser holds the account's
      // password: the verify step may go straight to sign-in (Q-061, D-186).
      return { ok: true, data: { next: 'verify', createdHere: true } };
    }
    if (code === 'not_authorized') {
      return error('auth.invalid_credentials', 'Email or password is incorrect', 'shop.auth.error.invalidCredentials');
    }
    if (code === 'limit_exceeded') return tooMany();
    deps.log?.('sign-in failed', { emailHash: emailHash(email), code });
    return unavailable();
  }
}

/** Starts a reset. Always answers "if this email has an account, we sent a code", whatever Cognito says. */
export async function requestPasswordReset(
  deps: CustomerAuthDeps,
  input: Base & { email: string },
): Promise<Result<{ next: 'reset' }>> {
  const gated = await gate(deps, 'forgot_password', input);
  if ('refusal' in gated) return gated.refusal;
  const cognito = deps.getCognito();
  await quietly(deps, 'forgot password', gated.email, () => cognito.forgotPassword({ email: gated.email }));
  return { ok: true, data: { next: 'reset' } };
}

/** Finishes a reset with the emailed code and ends every session of that customer. */
export async function confirmPasswordReset(
  deps: CustomerAuthDeps,
  input: Base & { email: string; code: string; newPassword: string },
): Promise<Result<{ next: 'sign_in' }>> {
  const gated = await gate(deps, 'verify', input);
  if ('refusal' in gated) return gated.refusal;
  try {
    await deps.getCognito().confirmForgotPassword({ email: gated.email, code: input.code, newPassword: input.newPassword });
  } catch (e) {
    // Wrong code, unconfirmed account and unknown user must look alike (Q-060), and Cognito may report
    // the unconfirmed case as an unmapped InvalidParameterException (`unavailable`); log the code only.
    if (codeOf(e) === 'unavailable') {
      deps.log?.('password reset failed', { emailHash: emailHash(gated.email), code: 'unavailable' });
      return invalidCode();
    }
    return codeFailure(e);
  }
  await endSessionsFor(deps, gated.email);
  return { ok: true, data: { next: 'sign_in' } };
}

/** Signs out this device. Not rate limited. */
export async function signOut(deps: CustomerAuthDeps, input: { token: string }): Promise<Result<{ next: 'signed_out' }>> {
  await endCustomerSession(deps.session, input.token);
  return { ok: true, data: { next: 'signed_out' } };
}
