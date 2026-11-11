'use server';

import { redirect } from 'next/navigation';

import { getCustomerAuthDeps } from '@/server/composition-root';
import {
  handleChoosePassword,
  handleForgotPassword,
  handleRegister,
  handleResendCode,
  handleResetPassword,
  handleSignIn,
  handleSignOut,
  handleVerify,
  type AuthActionOutcome,
  type AuthFormState,
  type AuthRequestContext,
} from '@/server/controllers/auth/customer-auth-controller';

import { applyCookieChanges, readRequestContext } from './auth-cookies';

/** The locale comes from a hidden form field; anything else falls back to the default, Thai. */
function localeOf(formData: FormData): 'th' | 'en' {
  return formData.get('locale') === 'en' ? 'en' : 'th';
}

async function run(
  formData: FormData,
  handler: (ctx: AuthRequestContext) => Promise<AuthActionOutcome>,
): Promise<AuthFormState> {
  const ctx = await readRequestContext();
  const outcome = await handler(ctx);
  await applyCookieChanges(outcome.cookies, ctx.now);
  if (outcome.state.redirectTo !== undefined) {
    redirect(`/${localeOf(formData)}${outcome.state.redirectTo === '/' ? '' : outcome.state.redirectTo}`);
  }
  return outcome.state;
}

export async function registerAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return run(formData, (ctx) => handleRegister(getCustomerAuthDeps(), formData, ctx));
}

export async function verifyAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return run(formData, (ctx) => handleVerify(getCustomerAuthDeps(), formData, ctx));
}

export async function choosePasswordAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return run(formData, (ctx) => handleChoosePassword(getCustomerAuthDeps(), formData, ctx));
}

export async function resendCodeAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return run(formData, (ctx) => handleResendCode(getCustomerAuthDeps(), formData, ctx));
}

export async function signInAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return run(formData, (ctx) => handleSignIn(getCustomerAuthDeps(), formData, ctx));
}

export async function forgotPasswordAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return run(formData, (ctx) => handleForgotPassword(getCustomerAuthDeps(), formData, ctx));
}

export async function resetPasswordAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return run(formData, (ctx) => handleResetPassword(getCustomerAuthDeps(), formData, ctx));
}

export async function signOutAction(formData: FormData): Promise<void> {
  const ctx = await readRequestContext();
  const outcome = await handleSignOut(getCustomerAuthDeps(), ctx);
  await applyCookieChanges(outcome.cookies, ctx.now);
  redirect(`/${localeOf(formData)}`);
}
