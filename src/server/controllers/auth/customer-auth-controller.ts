import { z } from 'zod';

import {
  confirmPasswordReset,
  confirmRegistration,
  register,
  requestPasswordReset,
  resendCode,
  signIn,
  signOut,
  type CustomerAuthDeps,
} from '@/server/services/auth/customer-auth-service';
import { PASSWORD_MAX_LENGTH, passwordSchema } from '@/server/services/auth/password-policy';
import { safeReturnTo } from '@/server/services/auth/return-to';
import type { DomainError } from '@/server/services/shared/result';

/**
 * Validates the auth forms and calls the service. It never touches cookies or redirects: it returns the
 * state for `useActionState` plus the cookie changes and redirect the thin Server Actions apply.
 */

export type AuthFormState = {
  /** Field name to message key. */
  fieldErrors?: Record<string, string>;
  /** A message key for the whole form. */
  formError?: string;
  /** A locale-less path; the action adds the locale. */
  redirectTo?: string;
  /** A message key for a non-error confirmation. */
  notice?: string;
  /**
   * The non-secret fields as submitted (`email`, `firstName`, `lastName`), so a failed attempt keeps what the
   * customer typed. Never a password or a code.
   */
  values?: Record<string, string>;
};

/** The only fields ever echoed back to a form. */
const ECHOED_FIELDS = ['email', 'firstName', 'lastName'] as const;

function echo(fields: Record<string, string>): { values?: Record<string, string> } {
  const values: Record<string, string> = {};
  for (const name of ECHOED_FIELDS) {
    if (fields[name] !== undefined) values[name] = fields[name];
  }
  return Object.keys(values).length === 0 ? {} : { values };
}

export type AuthCookieChanges = {
  setSession?: { token: string; expiresAt: Date };
  clearSession?: true;
  /** `createdHere` is required so every step that writes the pending cookie decides it (Q-061, D-186). */
  setPending?: { email: string; returnTo?: string; createdHere: boolean };
  clearPending?: true;
};

export type AuthActionOutcome = { state: AuthFormState; cookies?: AuthCookieChanges };

export type AuthRequestContext = {
  ip: string | null;
  now: Date;
  /** The email opened from `tinzshop_pending`, or null. */
  pendingEmail: string | null;
  /** The page to return to after sign-in, from `tinzshop_pending`; "/" or absent when there is none. */
  pendingReturnTo?: string;
  /** Whether this browser created the pending account (Q-061, D-186); absent reads as false. */
  pendingCreatedHere?: boolean;
  /** The raw `tinzshop_session` cookie value, if any. */
  sessionToken?: string;
};

const nameSchema = z
  .string()
  .trim()
  .min(1, 'shop.auth.error.nameRequired')
  .max(100, 'shop.auth.error.nameTooLong');
const emailSchema = z
  .string()
  .trim()
  .max(254, 'shop.auth.error.emailInvalid')
  .pipe(z.email('shop.auth.error.emailInvalid'));
const codeSchema = z.string().trim().regex(/^\d{6}$/, 'shop.auth.error.codeFormat');
const INVALID_CREDENTIALS = 'shop.auth.error.invalidCredentials';
// Server Actions take bodies up to 6mb (D-278), so every password sent to Cognito is capped at its maximum
// (`passwordSchema`, and sign-in below). The confirmation needs no cap of its own: it is only compared, never sent,
// and one over the maximum either differs from the password (the mismatch error) or equals an over-long password that
// fails its own check. A cap here would add a false "passwords don't match" when both are the same over-long value.
const passwordConfirmSchema = z.string();
const passwordPair = z
  .object({ password: passwordSchema, passwordConfirm: passwordConfirmSchema })
  .refine((v) => v.password === v.passwordConfirm, { path: ['passwordConfirm'], message: 'shop.auth.error.passwordMismatch' });

const registerSchema = z
  .object({ firstName: nameSchema, lastName: nameSchema, email: emailSchema, password: passwordSchema, passwordConfirm: passwordConfirmSchema })
  .refine((v) => v.password === v.passwordConfirm, { path: ['passwordConfirm'], message: 'shop.auth.error.passwordMismatch' });
// No account has a password longer than Cognito's maximum, so sign-in answers one as a wrong password (D-227).
const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'shop.auth.error.passwordRequired').max(PASSWORD_MAX_LENGTH, INVALID_CREDENTIALS),
});
const emailOnlySchema = z.object({ email: emailSchema });
const codeOnlySchema = z.object({ code: codeSchema });
const codeAndPasswordSchema = z.object({ code: codeSchema }).and(passwordPair);

function fieldsOf(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === 'string') fields[name] = value;
  }
  return fields;
}

function invalid(error: z.ZodError, fields: Record<string, string> = {}): AuthActionOutcome {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form');
    fieldErrors[field] ??= issue.message;
  }
  return { state: { fieldErrors, ...echo(fields) } };
}

function failure(error: DomainError, extra: AuthFormState = {}, fields: Record<string, string> = {}): AuthActionOutcome {
  extra = { ...extra, ...echo(fields) };
  const field = (error.details as { field?: unknown } | undefined)?.field;
  if (typeof field === 'string') return { state: { ...extra, fieldErrors: { [field]: error.messageKey } } };
  return { state: { ...extra, formError: error.messageKey } };
}

/**
 * The pending cookie is missing or over an hour old: back to the first step, which explains with
 * `?expired=1`. There is no formError because the action redirects and a redirect carries no state.
 */
function pendingGone(path: string): AuthActionOutcome {
  return { state: { redirectTo: `${path}?expired=1` } };
}

export async function handleRegister(deps: CustomerAuthDeps, formData: FormData, ctx: AuthRequestContext): Promise<AuthActionOutcome> {
  const fields = fieldsOf(formData);
  const parsed = registerSchema.safeParse(fields);
  if (!parsed.success) return invalid(parsed.error, fields);
  const result = await register(deps, { ...parsed.data, ip: ctx.ip, now: ctx.now });
  if (!result.ok) return failure(result.error, {}, fields);
  return {
    state: { redirectTo: '/register/verify' },
    cookies: {
      setPending: {
        email: parsed.data.email.toLowerCase(),
        returnTo: safeReturnTo(fields.returnTo ?? null),
        createdHere: result.data.createdHere,
      },
    },
  };
}

/**
 * Where the verify page's "Got a password-reset email instead? Set a new password" link goes (Q-060, D-179).
 * It shows the code and new-password fields for the email in the pending cookie, and sends no new code.
 */
export const PASSWORD_RESET_CODE_PATH = '/forgot-password?step=reset';

/** `&returnTo=…` for a safe, non-trivial path from the pending cookie, else nothing. Checked again here, not trusted. */
function returnToQuery(returnTo: string | undefined): string {
  const safe = safeReturnTo(returnTo ?? null);
  return safe === '/' ? '' : `&returnTo=${encodeURIComponent(safe)}`;
}

/**
 * The 6-digit code step. Every failure is the same wrong-code answer, whoever owns the email (Q-060). After a
 * correct code, an account created in this browser goes to sign-in; any other goes to the reset step with a
 * second code, so a password chosen by somebody else never survives (Q-061, D-186). Either way the pending
 * cookie is left as it is: sign-in prefills its email, and the reset step reads the email and `returnTo`.
 */
export async function handleVerify(deps: CustomerAuthDeps, formData: FormData, ctx: AuthRequestContext): Promise<AuthActionOutcome> {
  if (ctx.pendingEmail === null) return pendingGone('/register');
  const parsed = codeOnlySchema.safeParse(fieldsOf(formData));
  if (!parsed.success) return invalid(parsed.error);
  const result = await confirmRegistration(deps, {
    email: ctx.pendingEmail,
    code: parsed.data.code,
    createdHere: ctx.pendingCreatedHere === true,
    ip: ctx.ip,
    now: ctx.now,
  });
  if (!result.ok) return failure(result.error);
  if (result.data.next === 'set_password') return { state: { redirectTo: `${PASSWORD_RESET_CODE_PATH}&setPassword=1` } };
  // R1 (D-173): no auto sign-in.
  return { state: { redirectTo: `/sign-in?confirmed=1${returnToQuery(ctx.pendingReturnTo)}` } };
}

export async function handleResendCode(deps: CustomerAuthDeps, _formData: FormData, ctx: AuthRequestContext): Promise<AuthActionOutcome> {
  if (ctx.pendingEmail === null) return pendingGone('/register');
  const result = await resendCode(deps, { email: ctx.pendingEmail, ip: ctx.ip, now: ctx.now });
  if (!result.ok) return failure(result.error);
  return { state: { notice: 'shop.auth.verify.resent' } };
}

export async function handleSignIn(deps: CustomerAuthDeps, formData: FormData, ctx: AuthRequestContext): Promise<AuthActionOutcome> {
  const fields = fieldsOf(formData);
  const parsed = signInSchema.safeParse(fields);
  if (!parsed.success) {
    const outcome = invalid(parsed.error, fields);
    const { fieldErrors = {}, ...state } = outcome.state;
    const { email: emailError, password: passwordError, ...rest } = fieldErrors;
    const passwordTooLong = passwordError === INVALID_CREDENTIALS;
    if (emailError === undefined && !passwordTooLong) return outcome;
    // No account has a malformed address or a password over the maximum, so sign-in answers either exactly as a wrong
    // password: the customer is told their email or password is wrong, nothing more (D-227). A missing password is
    // still asked for.
    const otherErrors = passwordError === undefined || passwordTooLong ? rest : { ...rest, password: passwordError };
    return {
      state: {
        ...state,
        formError: INVALID_CREDENTIALS,
        ...(Object.keys(otherErrors).length > 0 ? { fieldErrors: otherErrors } : {}),
      },
    };
  }
  const result = await signIn(deps, { ...parsed.data, ip: ctx.ip, now: ctx.now, previousToken: ctx.sessionToken });
  if (!result.ok) return failure(result.error, {}, fields);
  if (result.data.next === 'verify') {
    return {
      state: { redirectTo: '/register/verify' },
      cookies: {
        setPending: {
          email: parsed.data.email.toLowerCase(),
          returnTo: safeReturnTo(fields.returnTo ?? null),
          createdHere: result.data.createdHere,
        },
      },
    };
  }
  return {
    state: { redirectTo: safeReturnTo(fields.returnTo ?? null) },
    cookies: { setSession: result.data.session, clearPending: true },
  };
}

export async function handleForgotPassword(
  deps: CustomerAuthDeps,
  formData: FormData,
  ctx: AuthRequestContext,
): Promise<AuthActionOutcome> {
  const fields = fieldsOf(formData);
  const parsed = emailOnlySchema.safeParse(fields);
  if (!parsed.success) return invalid(parsed.error, fields);
  const result = await requestPasswordReset(deps, { email: parsed.data.email, ip: ctx.ip, now: ctx.now });
  if (!result.ok) return failure(result.error, {}, fields);
  // A redirect, not a client-side swap: the cookie is set in this response, so the code step survives a reload.
  // `returnTo` comes from the form (the sign-in page's link passes it on), else from the cookie already there.
  return {
    state: { redirectTo: PASSWORD_RESET_CODE_PATH },
    cookies: {
      setPending: {
        email: parsed.data.email.toLowerCase(),
        returnTo: safeReturnTo(fields.returnTo ?? ctx.pendingReturnTo ?? null),
        createdHere: false,
      },
    },
  };
}

/**
 * "Send a new code" on the reset step: a new reset code for the email in the pending cookie, so an expired code or
 * a failed second code (Q-061) is never a dead end. The same answer whatever Cognito says, under the
 * `forgot_password` limit; the pending cookie is left as it is.
 */
export async function handleResendResetCode(
  deps: CustomerAuthDeps,
  _formData: FormData,
  ctx: AuthRequestContext,
): Promise<AuthActionOutcome> {
  if (ctx.pendingEmail === null) return pendingGone('/forgot-password');
  const result = await requestPasswordReset(deps, { email: ctx.pendingEmail, ip: ctx.ip, now: ctx.now });
  if (!result.ok) return failure(result.error);
  return { state: { notice: 'shop.auth.forgot.resent' } };
}

export async function handleResetPassword(
  deps: CustomerAuthDeps,
  formData: FormData,
  ctx: AuthRequestContext,
): Promise<AuthActionOutcome> {
  if (ctx.pendingEmail === null) return pendingGone('/forgot-password');
  const parsed = codeAndPasswordSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return invalid(parsed.error);
  }
  const result = await confirmPasswordReset(deps, {
    email: ctx.pendingEmail,
    code: parsed.data.code,
    newPassword: parsed.data.password,
    ip: ctx.ip,
    now: ctx.now,
  });
  if (!result.ok) return failure(result.error);
  return { state: { redirectTo: `/sign-in?reset=1${returnToQuery(ctx.pendingReturnTo)}` } };
}

export async function handleSignOut(deps: CustomerAuthDeps, ctx: AuthRequestContext): Promise<AuthActionOutcome> {
  if (ctx.sessionToken !== undefined && ctx.sessionToken !== '') {
    try {
      await signOut(deps, { token: ctx.sessionToken });
    } catch {
      // The customer asked to leave, so the cookie goes whatever happened to the row. Nothing from the error is logged.
      deps.log?.('sign-out failed to end the session', {});
    }
  }
  return { state: { redirectTo: '/sign-in' }, cookies: { clearSession: true } };
}
