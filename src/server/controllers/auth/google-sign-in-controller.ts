import { createHash, randomBytes } from 'node:crypto';

import { isCognitoError } from '@/server/services/auth/cognito-identity';
import { startSessionFromTokens, type CustomerAuthDeps } from '@/server/services/auth/customer-auth-service';
import type { OauthLocale, OauthState } from '@/server/services/auth/oauth-state-token';
import { safeReturnTo } from '@/server/services/auth/return-to';

/**
 * The two Google sign-in route handlers' logic (plan 014 Task 8). It reads no cookies and writes none:
 * it returns where to redirect and which cookie changes the thin route handlers apply.
 */

/**
 * UNVERIFIED until the manual Google test (plan 014 Task 2 check 3 was not run). The text Cognito is
 * expected to put in `error_description` when the first Google sign-in after account linking fails once
 * inside Cognito. Compared case-insensitively. If the real text differs, change this one constant.
 */
export const LINKING_ERROR_DESCRIPTION = 'Already found an entry for username';

export type GoogleSignInDeps = {
  auth: CustomerAuthDeps;
  /** `{APP_URL}/api/callbacks/cognito`, registered on the app client. */
  redirectUri: string;
};

export type GoogleOutcome = {
  /** A site-relative path or Cognito's absolute authorize URL. */
  location: string;
  setOauth?: OauthState;
  clearOauth?: true;
  setSession?: { token: string; expiresAt: Date };
};

export type GoogleCallbackInput = {
  code: string | null;
  state: string | null;
  error: string | null;
  errorDescription: string | null;
  /** The opened `tinzshop_oauth` cookie, or null when it is missing, expired or tampered with. */
  oauth: OauthState | null;
  /** The `tinzshop_session` cookie the browser already holds, if any: that session ends before the new one starts. */
  sessionToken?: string | undefined;
  now: Date;
};

const DEFAULT_LOCALE: OauthLocale = 'th';

export function localeOf(value: string | null): OauthLocale {
  return value === 'en' || value === 'th' ? value : DEFAULT_LOCALE;
}

const failure = (locale: OauthLocale): GoogleOutcome => ({
  location: `/${locale}/sign-in?error=google`,
  clearOauth: true,
});

/** A fresh `state` and PKCE verifier; the challenge is the S256 of the verifier. */
function authorizeStep(deps: GoogleSignInDeps, base: Omit<OauthState, 'state' | 'codeVerifier'>): GoogleOutcome {
  const state = randomBytes(32).toString('base64url');
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const location = deps.auth.getCognito().googleAuthorizeUrl({ state, codeChallenge, redirectUri: deps.redirectUri });
  return { location, setOauth: { ...base, state, codeVerifier } };
}

function logFailure(deps: GoogleSignInDeps, code: string): void {
  deps.auth.log?.('google sign-in failed', { code });
}

/** The name or code of a thrown value: a Cognito code, else the error's name. Never its message. */
function codeOf(e: unknown): string {
  if (isCognitoError(e)) return e.code;
  return e instanceof Error ? e.name : 'unknown';
}

export function startGoogleSignIn(
  deps: GoogleSignInDeps,
  input: { returnTo: string | null; locale: string | null },
): GoogleOutcome {
  const locale = localeOf(input.locale);
  try {
    return authorizeStep(deps, { returnTo: safeReturnTo(input.returnTo), locale, retried: false });
  } catch (e) {
    logFailure(deps, codeOf(e));
    return failure(locale);
  }
}

function sameState(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return left.equals(right);
}

export async function handleGoogleCallback(deps: GoogleSignInDeps, input: GoogleCallbackInput): Promise<GoogleOutcome> {
  const { oauth } = input;
  if (oauth === null) {
    logFailure(deps, 'oauth_cookie_invalid');
    return failure(DEFAULT_LOCALE);
  }
  const locale = localeOf(oauth.locale);
  try {
    if (input.state === null || !sameState(input.state, oauth.state)) {
      logFailure(deps, 'state_mismatch');
      return failure(locale);
    }
    if (input.error !== null) {
      const linking = (input.errorDescription ?? '').toLowerCase().includes(LINKING_ERROR_DESCRIPTION.toLowerCase());
      if (linking && !oauth.retried) {
        return authorizeStep(deps, { returnTo: oauth.returnTo, locale, retried: true });
      }
      logFailure(deps, linking ? 'linking_error_repeated' : 'provider_error');
      return failure(locale);
    }
    if (input.code === null || input.code === '') {
      logFailure(deps, 'missing_code');
      return failure(locale);
    }
    const cognito = deps.auth.getCognito();
    const tokens = await cognito.exchangeCode({
      code: input.code,
      codeVerifier: oauth.codeVerifier,
      redirectUri: deps.redirectUri,
    });
    const signedIn = await startSessionFromTokens(deps.auth, cognito, { tokens, now: input.now, previousToken: input.sessionToken });
    if (signedIn === 'email_taken') return failure(locale); // already logged by hash
    return {
      location: `/${locale}${safeReturnTo(oauth.returnTo)}`,
      clearOauth: true,
      setSession: signedIn.session,
    };
  } catch (e) {
    logFailure(deps, codeOf(e));
    return failure(locale);
  }
}
