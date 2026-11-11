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
import { passwordSchema } from '@/server/services/auth/password-policy';
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
  /** Which step the page shows next when it stays on the same route. */
  step?: 'reset';
};

export type AuthCookieChanges = {
  setSession?: { token: string; expiresAt: Date };
  clearSession?: true;
  setPending?: { email: string };
  clearPending?: true;
};

export type AuthActionOutcome = { state: AuthFormState; cookies?: AuthCookieChanges };

export type AuthRequestContext = {
  ip: string | null;
  now: Date;
  /** The email opened from `tinzshop_pending`, or null. */
  pendingEmail: string | null;
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
const passwordPair = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { path: ['passwordConfirm'], message: 'shop.auth.error.passwordMismatch' });

const registerSchema = z
  .object({ firstName: nameSchema, lastName: nameSchema, email: emailSchema, password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { path: ['passwordConfirm'], message: 'shop.auth.error.passwordMismatch' });
const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'shop.auth.error.passwordRequired') });
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

function invalid(error: z.ZodError): AuthActionOutcome {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form');
    fieldErrors[field] ??= issue.message;
  }
  return { state: { fieldErrors } };
}

function failure(error: DomainError, extra: AuthFormState = {}): AuthActionOutcome {
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
  const parsed = registerSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) return invalid(parsed.error);
  const result = await register(deps, { ...parsed.data, ip: ctx.ip, now: ctx.now });
  if (!result.ok) return failure(result.error);
  return { state: { redirectTo: '/register/verify' }, cookies: { setPending: { email: parsed.data.email.toLowerCase() } } };
}

/**
 * Where the verify page's "Got a password-reset email instead? Set a new password" link goes (Q-060, D-179).
 * It shows the code and new-password fields for the email in the pending cookie, and sends no new code.
 */
export const PASSWORD_RESET_CODE_PATH = '/forgot-password?step=reset';

/** The 6-digit code step. Every failure is the same wrong-code answer, whoever owns the email (Q-060). */
export async function handleVerify(deps: CustomerAuthDeps, formData: FormData, ctx: AuthRequestContext): Promise<AuthActionOutcome> {
  if (ctx.pendingEmail === null) return pendingGone('/register');
  const parsed = codeOnlySchema.safeParse(fieldsOf(formData));
  if (!parsed.success) return invalid(parsed.error);
  const result = await confirmRegistration(deps, { email: ctx.pendingEmail, code: parsed.data.code, ip: ctx.ip, now: ctx.now });
  if (!result.ok) return failure(result.error);
  // R1 (D-173): no auto sign-in. The pending cookie stays so the sign-in page can prefill the email.
  return { state: { redirectTo: '/sign-in?confirmed=1' } };
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
  if (!parsed.success) return invalid(parsed.error);
  const result = await signIn(deps, { ...parsed.data, ip: ctx.ip, now: ctx.now });
  if (!result.ok) return failure(result.error);
  if (result.data.next === 'verify') {
    return { state: { redirectTo: '/register/verify' }, cookies: { setPending: { email: parsed.data.email.toLowerCase() } } };
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
  const parsed = emailOnlySchema.safeParse(fieldsOf(formData));
  if (!parsed.success) return invalid(parsed.error);
  const result = await requestPasswordReset(deps, { email: parsed.data.email, ip: ctx.ip, now: ctx.now });
  if (!result.ok) return failure(result.error);
  return { state: { step: 'reset' }, cookies: { setPending: { email: parsed.data.email.toLowerCase() } } };
}

export async function handleResetPassword(
  deps: CustomerAuthDeps,
  formData: FormData,
  ctx: AuthRequestContext,
): Promise<AuthActionOutcome> {
  if (ctx.pendingEmail === null) return pendingGone('/forgot-password');
  const parsed = codeAndPasswordSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    const outcome = invalid(parsed.error);
    return { state: { ...outcome.state, step: 'reset' } };
  }
  const result = await confirmPasswordReset(deps, {
    email: ctx.pendingEmail,
    code: parsed.data.code,
    newPassword: parsed.data.password,
    ip: ctx.ip,
    now: ctx.now,
  });
  if (!result.ok) return failure(result.error, { step: 'reset' });
  return { state: { redirectTo: '/sign-in?reset=1' } };
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
  return { state: { redirectTo: '/' }, cookies: { clearSession: true } };
}
