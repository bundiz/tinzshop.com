import { describe, expect, it } from 'vitest';

import { OAUTH_LIFETIME_MS, openOauth, sealOauth, type OauthState } from './oauth-state-token';

const key = Buffer.alloc(32, 7);
const now = new Date('2026-11-10T00:00:00Z');
const value: OauthState = { state: 's', codeVerifier: 'v', returnTo: '/x', locale: 'en', retried: false };

describe('oauth state token', () => {
  it('round-trips', () => {
    expect(openOauth(sealOauth(value, key, now), key, now)).toEqual(value);
  });
  it('rejects missing, tampered, wrong-key and expired values', () => {
    const sealed = sealOauth(value, key, now);
    expect(openOauth(undefined, key, now)).toBeNull();
    expect(openOauth(`${sealed}x`, key, now)).toBeNull();
    expect(openOauth(sealed, Buffer.alloc(32, 8), now)).toBeNull();
    expect(openOauth(sealed, key, new Date(now.getTime() + OAUTH_LIFETIME_MS + 1))).toBeNull();
  });
});
