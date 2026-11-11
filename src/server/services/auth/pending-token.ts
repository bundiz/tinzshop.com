import { decryptSecret, encryptSecret } from '@/lib/secret-box';

/** How long `tinzshop_pending` lives: the cookie's max age and the age this module accepts. */
export const PENDING_LIFETIME_MS = 60 * 60 * 1000;

/** Seals the email the customer is verifying or resetting, for the `tinzshop_pending` cookie. */
export function sealPending(email: string, key: Buffer, now: Date): string {
  return encryptSecret(JSON.stringify({ email: email.trim().toLowerCase(), at: now.getTime() }), key);
}

/** The email in a pending cookie, or null when it is missing, tampered with, or over an hour old. */
export function openPending(sealed: string | undefined, key: Buffer, now: Date): string | null {
  if (sealed === undefined || sealed === '') return null;
  try {
    const value = JSON.parse(decryptSecret(sealed, key)) as { email?: unknown; at?: unknown };
    if (typeof value.email !== 'string' || typeof value.at !== 'number') return null;
    if (now.getTime() - value.at > PENDING_LIFETIME_MS || value.at > now.getTime() + 60_000) return null;
    return value.email;
  } catch {
    return null;
  }
}
