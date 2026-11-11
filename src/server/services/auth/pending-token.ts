import { decryptSecret, encryptSecret } from '@/lib/secret-box';

import { safeReturnTo } from './return-to';

/** How long `tinzshop_pending` lives: the cookie's max age and the age this module accepts. */
export const PENDING_LIFETIME_MS = 60 * 60 * 1000;

/** What `tinzshop_pending` holds: the email being verified or reset, and the page to return to after sign-in. */
export type PendingState = { email: string; returnTo: string };

/**
 * Seals the email the customer is verifying or resetting, with the page to return to after sign-in, for the
 * `tinzshop_pending` cookie. `returnTo` goes through `safeReturnTo` on the way in.
 */
export function sealPending(email: string, key: Buffer, now: Date, returnTo?: string | null): string {
  return encryptSecret(
    JSON.stringify({ email: email.trim().toLowerCase(), returnTo: safeReturnTo(returnTo ?? null), at: now.getTime() }),
    key,
  );
}

/** The state in a pending cookie, or null when it is missing, tampered with, or over an hour old. `returnTo` is checked again on the way out. */
export function openPendingState(sealed: string | undefined, key: Buffer, now: Date): PendingState | null {
  if (sealed === undefined || sealed === '') return null;
  try {
    const value = JSON.parse(decryptSecret(sealed, key)) as { email?: unknown; returnTo?: unknown; at?: unknown };
    if (typeof value.email !== 'string' || typeof value.at !== 'number') return null;
    if (now.getTime() - value.at > PENDING_LIFETIME_MS || value.at > now.getTime() + 60_000) return null;
    return { email: value.email, returnTo: safeReturnTo(typeof value.returnTo === 'string' ? value.returnTo : null) };
  } catch {
    return null;
  }
}

/** The email in a pending cookie, or null. */
export function openPending(sealed: string | undefined, key: Buffer, now: Date): string | null {
  return openPendingState(sealed, key, now)?.email ?? null;
}
