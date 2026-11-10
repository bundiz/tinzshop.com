import { createHash } from 'node:crypto';

export type AuthRateLimitAction = 'sign_in' | 'register' | 'verify' | 'resend' | 'forgot_password';

export type AuthRateLimitDeps = {
  /** Increments and returns the count for (key, windowStart); deletes rows older than sweepBefore. */
  hitRateLimit(key: string, windowStart: Date, sweepBefore: Date): Promise<number>;
};

export type AuthRateLimitResult =
  | { ok: true }
  | { ok: false; error: { code: 'auth.rate_limited'; messageKey: 'shop.auth.error.rateLimited' } };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const LIMITS: Record<AuthRateLimitAction, { max: number; windowMs: number }> = {
  sign_in: { max: 10, windowMs: 15 * MINUTE },
  register: { max: 5, windowMs: HOUR },
  verify: { max: 5, windowMs: HOUR },
  resend: { max: 5, windowMs: HOUR },
  forgot_password: { max: 5, windowMs: HOUR },
};

/** The longest window, so the sweep cutoff is always earlier than any live window start. */
const SWEEP_AGE_MS = HOUR;

/**
 * Counts this attempt against the IP and the email, and refuses when either is over its limit.
 * A null ip (no usable client-IP header) applies the email limit only.
 */
export async function checkAuthRateLimit(
  deps: AuthRateLimitDeps,
  action: AuthRateLimitAction,
  input: { ip: string | null; email: string; now: Date },
): Promise<AuthRateLimitResult> {
  const { max, windowMs } = LIMITS[action];
  const nowMs = input.now.getTime();
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs);
  const sweepBefore = new Date(nowMs - SWEEP_AGE_MS);

  const emailHash = createHash('sha256').update(input.email.trim().toLowerCase()).digest('hex');
  const keys = [`${action}:email:${emailHash}`];
  if (input.ip !== null) keys.unshift(`${action}:ip:${input.ip}`);

  let limited = false;
  for (const key of keys) {
    const count = await deps.hitRateLimit(key, windowStart, sweepBefore);
    if (count > max) limited = true;
  }

  return limited
    ? { ok: false, error: { code: 'auth.rate_limited', messageKey: 'shop.auth.error.rateLimited' } }
    : { ok: true };
}
