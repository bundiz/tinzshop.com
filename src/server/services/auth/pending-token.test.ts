import { describe, expect, it } from 'vitest';

import { encryptSecret } from '@/lib/secret-box';

import { openPending, openPendingState, sealPending } from './pending-token';

const key = Buffer.alloc(32, 7);
const NOW = new Date('2026-11-10T00:00:00Z');

describe('the pending cookie', () => {
  it('carries the email and the page to return to', () => {
    const sealed = sealPending('Ann@Example.com', key, NOW, '/product/abc/detail');
    expect(openPendingState(sealed, key, NOW)).toEqual({ email: 'ann@example.com', returnTo: '/product/abc/detail' });
    expect(openPending(sealed, key, NOW)).toBe('ann@example.com');
  });

  it('returns to "/" when none was given, and an unsafe one is dropped when writing', () => {
    expect(openPendingState(sealPending('a@example.com', key, NOW), key, NOW)?.returnTo).toBe('/');
    expect(openPendingState(sealPending('a@example.com', key, NOW, '//evil.test'), key, NOW)?.returnTo).toBe('/');
  });

  it('an unsafe returnTo inside the cookie falls back to "/" when reading', () => {
    for (const bad of ['//evil.test', 'https://evil.test', '/TH/x', '/a\\b', `/${'a'.repeat(600)}`]) {
      const sealed = encryptSecret(JSON.stringify({ email: 'a@example.com', returnTo: bad, at: NOW.getTime() }), key);
      expect(openPendingState(sealed, key, NOW), bad).toEqual({ email: 'a@example.com', returnTo: '/' });
    }
  });

  it('an older cookie with no returnTo still opens', () => {
    const sealed = encryptSecret(JSON.stringify({ email: 'a@example.com', at: NOW.getTime() }), key);
    expect(openPendingState(sealed, key, NOW)).toEqual({ email: 'a@example.com', returnTo: '/' });
  });
});
