import { describe, expect, it } from 'vitest';

import { encryptSecret } from '@/lib/secret-box';

import { openPending, openPendingState, sealPending } from './pending-token';

const key = Buffer.alloc(32, 7);
const NOW = new Date('2026-11-10T00:00:00Z');

describe('the pending cookie', () => {
  it('carries the email and the page to return to', () => {
    const sealed = sealPending('Ann@Example.com', key, NOW, '/product/abc/detail');
    expect(openPendingState(sealed, key, NOW)).toEqual({ email: 'ann@example.com', returnTo: '/product/abc/detail', createdHere: false });
    expect(openPending(sealed, key, NOW)).toBe('ann@example.com');
  });

  it('returns to "/" when none was given, and an unsafe one is dropped when writing', () => {
    expect(openPendingState(sealPending('a@example.com', key, NOW), key, NOW)?.returnTo).toBe('/');
    expect(openPendingState(sealPending('a@example.com', key, NOW, '//evil.test'), key, NOW)?.returnTo).toBe('/');
  });

  it('an unsafe returnTo inside the cookie falls back to "/" when reading', () => {
    for (const bad of ['//evil.test', 'https://evil.test', '/TH/x', '/a\\b', `/${'a'.repeat(600)}`]) {
      const sealed = encryptSecret(JSON.stringify({ email: 'a@example.com', returnTo: bad, at: NOW.getTime() }), key);
      expect(openPendingState(sealed, key, NOW), bad).toEqual({ email: 'a@example.com', returnTo: '/', createdHere: false });
    }
  });

  it('an older cookie with no returnTo still opens', () => {
    const sealed = encryptSecret(JSON.stringify({ email: 'a@example.com', at: NOW.getTime() }), key);
    expect(openPendingState(sealed, key, NOW)).toEqual({ email: 'a@example.com', returnTo: '/', createdHere: false });
  });

  it('carries whether the account was created in this browser (Q-061)', () => {
    expect(openPendingState(sealPending('a@example.com', key, NOW, '/', true), key, NOW)?.createdHere).toBe(true);
    expect(openPendingState(sealPending('a@example.com', key, NOW, '/', false), key, NOW)?.createdHere).toBe(false);
    expect(openPendingState(sealPending('a@example.com', key, NOW), key, NOW)?.createdHere).toBe(false);
  });

  it('an old pending cookie without the flag is treated as not created here', () => {
    const sealed = encryptSecret(JSON.stringify({ email: 'a@example.com', returnTo: '/product', at: NOW.getTime() }), key);
    expect(openPendingState(sealed, key, NOW)).toEqual({ email: 'a@example.com', returnTo: '/product', createdHere: false });
    // Only the written marker counts; anything else reads as false.
    for (const odd of [true, 'true', 2, null]) {
      const other = encryptSecret(JSON.stringify({ email: 'a@example.com', createdHere: odd, at: NOW.getTime() }), key);
      expect(openPendingState(other, key, NOW)?.createdHere, String(odd)).toBe(false);
    }
  });

  it('the sealed value is the same length whether or not the account was created here', () => {
    // A stranger must not tell the two apart from the cookie's size (D-160, Q-061).
    const a = sealPending('a@example.com', key, NOW, '/product', true);
    const b = sealPending('a@example.com', key, NOW, '/product', false);
    expect(a.length).toBe(b.length);
  });
});
