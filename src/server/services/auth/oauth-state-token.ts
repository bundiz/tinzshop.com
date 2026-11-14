import { decryptSecret, encryptSecret } from '@/lib/secret-box';

/** How long `tinzshop_oauth` lives: the cookie's max age and the age this module accepts. */
export const OAUTH_LIFETIME_MS = 10 * 60 * 1000;

export type OauthLocale = 'th' | 'en';

/** What `tinzshop_oauth` holds between `GET /api/auth/google` and the Cognito callback. */
export type OauthState = {
  state: string;
  codeVerifier: string;
  returnTo: string;
  locale: OauthLocale;
  retried: boolean;
};

export function sealOauth(value: OauthState, key: Buffer, now: Date): string {
  return encryptSecret(JSON.stringify({ ...value, at: now.getTime() }), key);
}

/** The state in a `tinzshop_oauth` cookie, or null when it is missing, tampered with, malformed or expired. */
export function openOauth(sealed: string | undefined, key: Buffer, now: Date): OauthState | null {
  if (sealed === undefined || sealed === '') return null;
  try {
    const v = JSON.parse(decryptSecret(sealed, key)) as Record<string, unknown>;
    if (
      typeof v.state !== 'string' ||
      typeof v.codeVerifier !== 'string' ||
      typeof v.returnTo !== 'string' ||
      (v.locale !== 'th' && v.locale !== 'en') ||
      typeof v.retried !== 'boolean' ||
      typeof v.at !== 'number'
    ) {
      return null;
    }
    if (now.getTime() - v.at > OAUTH_LIFETIME_MS || v.at > now.getTime() + 60_000) return null;
    return { state: v.state, codeVerifier: v.codeVerifier, returnTo: v.returnTo, locale: v.locale, retried: v.retried };
  } catch {
    return null;
  }
}
