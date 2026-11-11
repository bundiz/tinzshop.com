import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const key = randomBytes(32);
const set = vi.fn();
const jar = new Map<string, string>();
const getAuthConfig = vi.fn(() => ({ sessionTokenEncryptionKey: key, trustedProxyHeader: 'x-forwarded-for' as const }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (jar.has(n) ? { value: jar.get(n) } : undefined), set }),
  headers: async () => new Headers({ 'x-forwarded-for': '198.51.100.1, 203.0.113.7' }),
}));
vi.mock('@/server/config', () => ({ getAuthConfig: () => getAuthConfig() }));

import { openPending, sealPending } from '@/server/services/auth/pending-token';

import { applyCookieChanges, PENDING_COOKIE, readRequestContext, SESSION_COOKIE } from './auth-cookies';

const NOW = new Date('2026-11-10T00:00:00Z');

beforeEach(() => {
  set.mockClear();
  getAuthConfig.mockClear();
  jar.clear();
});

describe('auth cookies', () => {
  it('sets the session cookie HttpOnly, Lax, path /, until the session expires', async () => {
    const expiresAt = new Date(NOW.getTime() + 1000);
    await applyCookieChanges({ setSession: { token: 'tok', expiresAt } }, NOW);
    expect(set).toHaveBeenCalledWith(SESSION_COOKIE, 'tok', expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', secure: true, expires: expiresAt }));
  });

  it('seals the pending email for an hour and the context opens it again', async () => {
    await applyCookieChanges({ setPending: { email: 'Ann@Example.com' } }, NOW);
    const [name, sealed, options] = set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(name).toBe(PENDING_COOKIE);
    expect(sealed).not.toContain('ann@example.com');
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600 });
    expect(openPending(sealed, key, NOW)).toBe('ann@example.com');
    jar.set(PENDING_COOKIE, sealed);
    expect((await readRequestContext({ now: NOW })).pendingEmail).toBe('ann@example.com');
  });

  it('clears both cookies with maxAge 0', async () => {
    await applyCookieChanges({ clearSession: true, clearPending: true }, NOW);
    expect(set).toHaveBeenCalledWith(SESSION_COOKIE, '', expect.objectContaining({ maxAge: 0, path: '/' }));
    expect(set).toHaveBeenCalledWith(PENDING_COOKIE, '', expect.objectContaining({ maxAge: 0, path: '/' }));
  });

  it('the pending cookie carries a safe returnTo into the context', async () => {
    for (const [returnTo, expected] of [['/product/abc/detail', '/product/abc/detail'], ['//evil.test', '/']] as const) {
      set.mockClear();
      await applyCookieChanges({ setPending: { email: 'a@example.com', returnTo } }, NOW);
      jar.set(PENDING_COOKIE, (set.mock.calls[0] as [string, string])[1]);
      expect((await readRequestContext({ now: NOW })).pendingReturnTo).toBe(expected);
    }
  });

  it('a tampered pending cookie opens as null', async () => {
    jar.set(PENDING_COOKIE, `${sealPending('a@example.com', key, NOW)}x`);
    expect((await readRequestContext({ now: NOW })).pendingEmail).toBeNull();
  });

  it('a sign-out context reads no auth config', async () => {
    jar.set(SESSION_COOKIE, 'tok');
    const ctx = await readRequestContext({ now: NOW, signOut: true });
    expect(ctx.sessionToken).toBe('tok');
    expect(getAuthConfig).not.toHaveBeenCalled();
  });

  it('with no pending cookie the config is read only for the client IP', async () => {
    const ctx = await readRequestContext({ now: NOW });
    expect(ctx.pendingEmail).toBeNull();
    expect(ctx.ip).toBe('203.0.113.7');
    expect(getAuthConfig).toHaveBeenCalledTimes(1);
  });
});
