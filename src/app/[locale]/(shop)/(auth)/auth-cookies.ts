import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { getAuthConfig } from '@/server/config';
import type { GoogleOutcome } from '@/server/controllers/auth/google-sign-in-controller';
import type { AuthCookieChanges, AuthRequestContext } from '@/server/controllers/auth/customer-auth-controller';
import { resolveClientIp } from '@/server/services/auth/client-ip';
import { OAUTH_LIFETIME_MS, openOauth, sealOauth, type OauthState } from '@/server/services/auth/oauth-state-token';
import { openPending, PENDING_LIFETIME_MS, sealPending } from '@/server/services/auth/pending-token';

export const SESSION_COOKIE = 'tinzshop_session';
export const PENDING_COOKIE = 'tinzshop_pending';
export const OAUTH_COOKIE = 'tinzshop_oauth';

// Not exported from actions.ts: a 'use server' file may export only async functions.
const baseOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV !== 'development',
  path: '/',
});

/**
 * Reads what the controller needs from the request. Auth config is read only when needed: for the
 * client IP (every rate-limited action) and to open a pending cookie that is present. A sign-out
 * needs neither, so a config fault cannot stop a customer leaving.
 */
export async function readRequestContext(options: { now?: Date; signOut?: boolean } = {}): Promise<AuthRequestContext> {
  const jar = await cookies();
  const now = options.now ?? new Date();
  const sessionToken = jar.get(SESSION_COOKIE)?.value;
  const withSession = sessionToken !== undefined ? { sessionToken } : {};
  if (options.signOut) return { ip: null, now, pendingEmail: null, ...withSession };
  const config = getAuthConfig();
  const sealed = jar.get(PENDING_COOKIE)?.value;
  return {
    ip: resolveClientIp(await headers(), config.trustedProxyHeader),
    now,
    pendingEmail: openPending(sealed, config.sessionTokenEncryptionKey, now),
    ...withSession,
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

/** Opens `tinzshop_oauth` from a route handler's request; null when missing, expired or tampered with. */
export function readOauthCookie(request: Request, now: Date): OauthState | null {
  const header = request.headers.get('cookie') ?? '';
  const raw = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OAUTH_COOKIE}=`))
    ?.slice(OAUTH_COOKIE.length + 1);
  if (raw === undefined) return null;
  return openOauth(decodeURIComponent(raw), getAuthConfig().sessionTokenEncryptionKey, now);
}

/**
 * The 302 for a Google sign-in outcome, with the cookie changes applied and `Cache-Control: no-store`.
 * `tinzshop_oauth` is scoped to `/api`, so it is only sent to the two Google routes.
 */
export function googleRedirect(outcome: GoogleOutcome, now: Date): NextResponse {
  const response = new NextResponse(null, { status: 302, headers: { Location: outcome.location, 'Cache-Control': 'no-store' } });
  const options = { ...baseOptions(), path: '/api' };
  if (outcome.setOauth) {
    response.cookies.set(OAUTH_COOKIE, sealOauth(outcome.setOauth, getAuthConfig().sessionTokenEncryptionKey, now), {
      ...options,
      maxAge: OAUTH_LIFETIME_MS / 1000,
    });
  }
  if (outcome.clearOauth) response.cookies.set(OAUTH_COOKIE, '', { ...options, maxAge: 0 });
  if (outcome.setSession) {
    response.cookies.set(SESSION_COOKIE, outcome.setSession.token, { ...baseOptions(), expires: outcome.setSession.expiresAt });
  }
  return response;
}
