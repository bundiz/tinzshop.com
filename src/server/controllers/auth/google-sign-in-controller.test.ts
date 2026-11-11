import { describe, expect, it, vi } from 'vitest';

import { CognitoError } from '@/server/adapters/cognito/errors';
import type { CustomerAuthDeps } from '@/server/services/auth/customer-auth-service';
import type { OauthState } from '@/server/services/auth/oauth-state-token';

import { handleGoogleCallback, LINKING_ERROR_DESCRIPTION, startGoogleSignIn } from './google-sign-in-controller';

const NOW = new Date('2026-11-10T00:00:00Z');
const REDIRECT = 'http://localhost:3000/api/callbacks/cognito';
const oauth = (over: Partial<OauthState> = {}): OauthState => ({
  state: 'st1',
  codeVerifier: 'verifier1',
  returnTo: '/product/5/detail',
  locale: 'en',
  retried: false,
  ...over,
});

function build(over: { identity?: Record<string, unknown>; upsertOk?: boolean; exchange?: () => Promise<unknown> } = {}) {
  const cognito = {
    googleAuthorizeUrl: vi.fn(({ state }: { state: string }) => `https://auth.example.test/authorize?state=${state}`),
    exchangeCode: vi.fn(
      over.exchange ??
        (async () => ({ accessToken: 'A', idToken: 'I', refreshToken: 'R', accessExpiresAt: new Date(NOW.getTime() + 1e6) })),
    ),
    verifyIdToken: vi.fn(async () => ({
      sub: 'g-sub',
      email: 'Ann@Example.com',
      givenName: 'Ann',
      familyName: 'Lee',
      ...over.identity,
    })),
    revokeRefreshToken: vi.fn(async () => undefined),
  };
  const upsertBySub = vi.fn(async (i: { lastName: string | null }) =>
    over.upsertOk === false
      ? ({ ok: false, reason: 'email_taken' } as const)
      : ({ ok: true, customer: { id: 'c1', cognitoSub: 'g-sub', email: 'ann@example.com', firstName: 'Ann', lastName: i.lastName } } as const),
  );
  const log = vi.fn();
  const auth: CustomerAuthDeps = {
    getCognito: () => cognito as never,
    rateLimit: { hitRateLimit: async () => 1 },
    customers: { upsertBySub, findByEmail: async () => null },
    session: {
      getCognito: () => cognito as never,
      getSessionKey: () => Buffer.alloc(32, 1),
      sessions: { insert: async () => undefined, find: async () => null, updateAccessToken: async () => undefined, delete: async () => undefined, deleteAll: async () => undefined },
    },
    log,
  };
  return { deps: { auth, redirectUri: REDIRECT }, cognito, upsertBySub, log };
}

const callback = (o: Partial<Parameters<typeof handleGoogleCallback>[1]> = {}) => ({
  code: 'code1',
  state: 'st1',
  error: null,
  errorDescription: null,
  oauth: oauth(),
  now: NOW,
  ...o,
});

describe('GET /api/auth/google', () => {
  it('sets the oauth state and redirects to the authorize URL', () => {
    const { deps, cognito } = build();
    const out = startGoogleSignIn(deps, { returnTo: '/product/5/detail', locale: 'en' });
    expect(out.setOauth).toMatchObject({ returnTo: '/product/5/detail', locale: 'en', retried: false });
    expect(out.setOauth?.state).toMatch(/^[\w-]{43}$/);
    expect(out.setOauth?.codeVerifier).toMatch(/^[\w-]{43}$/);
    expect(out.location).toContain(out.setOauth!.state);
    expect(cognito.googleAuthorizeUrl.mock.calls[0]![0]).toMatchObject({ redirectUri: REDIRECT });
  });

  it('falls back to th and / for unknown values', () => {
    const { deps } = build();
    const out = startGoogleSignIn(deps, { returnTo: '//evil.example', locale: 'fr' });
    expect(out.setOauth).toMatchObject({ returnTo: '/', locale: 'th' });
  });
});

describe('GET /api/callbacks/cognito', () => {
  it('state mismatch is refused without a token exchange', async () => {
    const { deps, cognito } = build();
    const out = await handleGoogleCallback(deps, callback({ state: 'other' }));
    expect(out.location).toBe('/en/sign-in?error=google');
    expect(out.clearOauth).toBe(true);
    expect(cognito.exchangeCode).not.toHaveBeenCalled();
  });

  it('a missing or expired cookie goes to the failure redirect', async () => {
    const { deps, cognito } = build();
    const out = await handleGoogleCallback(deps, callback({ oauth: null }));
    expect(out.location).toBe('/th/sign-in?error=google');
    expect(cognito.exchangeCode).not.toHaveBeenCalled();
  });

  it('the linking error retries once, then shows the error', async () => {
    const { deps, cognito } = build();
    const linking = { error: 'server_error', errorDescription: `Already found an entry for username Google_123`, code: null };
    const first = await handleGoogleCallback(deps, callback(linking));
    expect(first.location).toContain('https://auth.example.test/authorize');
    expect(first.setOauth).toMatchObject({ retried: true, returnTo: '/product/5/detail', locale: 'en' });
    expect(first.setOauth?.state).not.toBe('st1');
    expect(first.setOauth?.codeVerifier).not.toBe('verifier1');

    const second = await handleGoogleCallback(deps, callback({ ...linking, oauth: first.setOauth!, state: first.setOauth!.state }));
    expect(second.location).toBe('/en/sign-in?error=google');
    expect(second.clearOauth).toBe(true);
    expect(second.setOauth).toBeUndefined();
    expect(cognito.googleAuthorizeUrl).toHaveBeenCalledTimes(1);
    expect(cognito.exchangeCode).not.toHaveBeenCalled();
  });

  it('matches the linking error case-insensitively and ignores other errors', async () => {
    const { deps } = build();
    expect(LINKING_ERROR_DESCRIPTION).toBe('Already found an entry for username');
    const lower = await handleGoogleCallback(deps, callback({ error: 'x', errorDescription: 'ALREADY FOUND AN ENTRY FOR USERNAME g', code: null }));
    expect(lower.setOauth?.retried).toBe(true);
    const other = await handleGoogleCallback(deps, callback({ error: 'access_denied', errorDescription: 'user denied', code: null }));
    expect(other.location).toBe('/en/sign-in?error=google');
  });

  it('success sets the session cookie and redirects to returnTo', async () => {
    const { deps, cognito } = build();
    const out = await handleGoogleCallback(deps, callback());
    expect(out.location).toBe('/en/product/5/detail');
    expect(out.clearOauth).toBe(true);
    expect(out.setSession?.token).toMatch(/^[\w-]{43}$/);
    expect(cognito.exchangeCode).toHaveBeenCalledWith({ code: 'code1', codeVerifier: 'verifier1', redirectUri: REDIRECT });
  });

  it('re-checks returnTo when the cookie value is unsafe', async () => {
    const { deps } = build();
    const out = await handleGoogleCallback(deps, callback({ oauth: oauth({ returnTo: '//evil.example' }) }));
    expect(out.location).toBe('/en/');
  });

  it('a missing last name from Google is accepted', async () => {
    const { deps, upsertBySub } = build({ identity: { familyName: null } });
    const out = await handleGoogleCallback(deps, callback());
    expect(upsertBySub).toHaveBeenCalledWith(expect.objectContaining({ lastName: null, email: 'ann@example.com' }));
    expect(out.setSession).toBeDefined();
  });

  it('an email held by another sub fails and logs the hash only', async () => {
    const { deps, log, cognito } = build({ upsertOk: false });
    const out = await handleGoogleCallback(deps, callback());
    expect(out.location).toBe('/en/sign-in?error=google');
    expect(out.setSession).toBeUndefined();
    expect(cognito.revokeRefreshToken).toHaveBeenCalledWith('R');
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toMatch(/[0-9a-f]{64}/);
    expect(logged).not.toMatch(/ann@example\.com/i);
    expect(logged).not.toMatch(/code1|"I"|"R"/);
  });

  it('a Cognito exchange failure fails closed and logs its code', async () => {
    const { deps, log } = build({ exchange: async () => { throw new CognitoError('not_authorized'); } });
    const out = await handleGoogleCallback(deps, callback());
    expect(out.location).toBe('/en/sign-in?error=google');
    expect(log).toHaveBeenCalledWith(expect.any(String), { code: 'not_authorized' });
  });

  it('an unexpected exception still redirects and logs its name, not a Cognito code', async () => {
    const { deps, log } = build({ exchange: async () => { throw new TypeError('boom code1'); } });
    const out = await handleGoogleCallback(deps, callback());
    expect(out.location).toBe('/en/sign-in?error=google');
    expect(log).toHaveBeenCalledWith(expect.any(String), { code: 'TypeError' });
  });
});
