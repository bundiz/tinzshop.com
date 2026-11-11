import { cookies, headers } from 'next/headers';

import { getAuthConfig } from '@/server/config';
import type { AuthCookieChanges, AuthRequestContext } from '@/server/controllers/auth/customer-auth-controller';
import { resolveClientIp } from '@/server/services/auth/client-ip';
import { openPending, PENDING_LIFETIME_MS, sealPending } from '@/server/services/auth/pending-token';

export const SESSION_COOKIE = 'tinzshop_session';
export const PENDING_COOKIE = 'tinzshop_pending';

// Not exported from actions.ts: a 'use server' file may export only async functions.
const baseOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV !== 'development',
  path: '/',
});

/** Reads what the controller needs from the request. Reads Cognito-side config only for the pending cookie. */
export async function readRequestContext(): Promise<AuthRequestContext> {
  const jar = await cookies();
  const now = new Date();
  const sealed = jar.get(PENDING_COOKIE)?.value;
  const sessionToken = jar.get(SESSION_COOKIE)?.value;
  const config = getAuthConfig();
  return {
    ip: resolveClientIp(await headers(), config.trustedProxyHeader),
    now,
    pendingEmail: openPending(sealed, config.sessionTokenEncryptionKey, now),
    ...(sessionToken !== undefined ? { sessionToken } : {}),
  };
}

/** Applies the cookie changes a controller asked for. Only Server Actions and route handlers may call this (D-174). */
export async function applyCookieChanges(changes: AuthCookieChanges | undefined, now: Date): Promise<void> {
  if (changes === undefined) return;
  const jar = await cookies();
  if (changes.setSession) {
    jar.set(SESSION_COOKIE, changes.setSession.token, { ...baseOptions(), expires: changes.setSession.expiresAt });
  }
  if (changes.clearSession) jar.set(SESSION_COOKIE, '', { ...baseOptions(), maxAge: 0 });
  if (changes.setPending) {
    jar.set(PENDING_COOKIE, sealPending(changes.setPending.email, getAuthConfig().sessionTokenEncryptionKey, now), {
      ...baseOptions(),
      maxAge: PENDING_LIFETIME_MS / 1000,
    });
  }
  if (changes.clearPending) jar.set(PENDING_COOKIE, '', { ...baseOptions(), maxAge: 0 });
}
