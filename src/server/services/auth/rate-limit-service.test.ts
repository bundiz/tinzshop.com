import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { checkAuthRateLimit, type AuthRateLimitDeps } from './rate-limit-service';

function fakeDeps() {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  const deps: AuthRateLimitDeps = {
    async hitRateLimit(key, windowStart) {
      keys.push(key);
      const k = `${key}|${windowStart.getTime()}`;
      const next = (counts.get(k) ?? 0) + 1;
      counts.set(k, next);
      return next;
    },
  };
  return { deps, keys };
}

const now = new Date('2026-11-10T10:00:00Z');
const refused = { ok: false, error: { code: 'auth.rate_limited', messageKey: 'shop.auth.error.rateLimited' } };

describe('checkAuthRateLimit', () => {
  it('11th sign-in in 15 minutes from one ip is refused', async () => {
    const { deps } = fakeDeps();
    for (let i = 0; i < 10; i++) {
      expect(await checkAuthRateLimit(deps, 'sign_in', { ip: '1.1.1.1', email: `u${i}@x.com`, now })).toEqual({ ok: true });
    }
    expect(await checkAuthRateLimit(deps, 'sign_in', { ip: '1.1.1.1', email: 'u11@x.com', now })).toEqual(refused);
  });

  it('the 10th sign-in is still allowed', async () => {
    const { deps } = fakeDeps();
    let last;
    for (let i = 0; i < 10; i++) last = await checkAuthRateLimit(deps, 'sign_in', { ip: '1.1.1.1', email: 'a@x.com', now });
    expect(last).toEqual({ ok: true });
  });

  it('6th forgot-password for one email from many ips is refused', async () => {
    const { deps } = fakeDeps();
    for (let i = 0; i < 5; i++) {
      expect(await checkAuthRateLimit(deps, 'forgot_password', { ip: `9.9.9.${i}`, email: 'a@x.com', now })).toEqual({ ok: true });
    }
    expect(await checkAuthRateLimit(deps, 'forgot_password', { ip: '9.9.9.99', email: 'a@x.com', now })).toEqual(refused);
  });

  it('email case does not split the counter', async () => {
    const { deps } = fakeDeps();
    const variants = ['A@X.com', 'a@x.com', ' a@X.COM ', 'A@x.com', 'a@X.com'];
    for (const email of variants) await checkAuthRateLimit(deps, 'register', { ip: null, email, now });
    expect(await checkAuthRateLimit(deps, 'register', { ip: null, email: 'a@x.COM', now })).toEqual(refused);
  });

  it('the raw email never appears in a key', async () => {
    const { deps, keys } = fakeDeps();
    await checkAuthRateLimit(deps, 'sign_in', { ip: '1.1.1.1', email: 'Secret@Example.com', now });
    expect(keys.some((k) => k.toLowerCase().includes('secret@example.com'))).toBe(false);
    const hash = createHash('sha256').update('secret@example.com').digest('hex');
    expect(keys).toContain(`sign_in:email:${hash}`);
    expect(keys).toContain('sign_in:ip:1.1.1.1');
  });

  it('a null ip applies only the email limit and writes no ip key', async () => {
    const { deps, keys } = fakeDeps();
    await checkAuthRateLimit(deps, 'verify', { ip: null, email: 'a@x.com', now });
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^verify:email:/);
  });

  it('a new window starts a fresh count', async () => {
    const { deps } = fakeDeps();
    for (let i = 0; i < 5; i++) await checkAuthRateLimit(deps, 'resend', { ip: '1.1.1.1', email: 'a@x.com', now });
    const later = new Date(now.getTime() + 61 * 60 * 1000);
    expect(await checkAuthRateLimit(deps, 'resend', { ip: '1.1.1.1', email: 'a@x.com', now: later })).toEqual({ ok: true });
  });

  it('sweeps with a cutoff never later than the window start', async () => {
    const calls: Array<[Date, Date]> = [];
    const deps: AuthRateLimitDeps = {
      async hitRateLimit(_k, windowStart, sweepBefore) {
        calls.push([windowStart, sweepBefore]);
        return 1;
      },
    };
    await checkAuthRateLimit(deps, 'sign_in', { ip: '1.1.1.1', email: 'a@x.com', now });
    for (const [w, s] of calls) expect(s.getTime()).toBeLessThanOrEqual(w.getTime());
  });
});
