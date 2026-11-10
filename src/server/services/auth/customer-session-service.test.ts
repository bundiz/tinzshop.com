import { createHash } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { CognitoError, type CognitoErrorCode } from '@/server/adapters/cognito/errors';
import { decryptSecret, encryptSecret } from '@/lib/secret-box';
import type { CustomerSessionRecord } from '@/server/repositories/auth/customer-session-repository';
import type { CustomerRecord } from '@/server/repositories/auth/customer-repository';

import {
  endAllCustomerSessions,
  endCustomerSession,
  readCustomerSession,
  startCustomerSession,
  type CustomerSessionDeps,
} from './customer-session-service';

const NOW = new Date('2026-11-10T00:00:00Z');
const key = randomBytes(32);
const customer: CustomerRecord = { id: 'c1', cognitoSub: 'sub-1', email: 'a@b.co', firstName: 'Som', lastName: null };
const sha = (v: string) => createHash('sha256').update(v).digest('hex');

type Row = CustomerSessionRecord & { customer: CustomerRecord };

function build(row: Row | null, refresh?: () => Promise<{ accessToken: string; idToken: string; accessExpiresAt: Date }>) {
  const state = { row, deleted: [] as string[], deletedAll: [] as string[], inserted: [] as unknown[], updates: [] as unknown[] };
  const revoke = vi.fn(async (_token: string) => undefined);
  const cognito = { refresh: vi.fn(refresh ?? (async () => ({ accessToken: 'A2', idToken: 'I2', accessExpiresAt: new Date(NOW.getTime() + 900_000) }))), revokeRefreshToken: revoke };
  const getCognito = vi.fn(() => cognito);
  const getSessionKey = vi.fn(() => key);
  const deps: CustomerSessionDeps = {
    getCognito,
    getSessionKey,
    sessions: {
      insert: async (r) => {
        state.inserted.push(r);
      },
      find: async (hash) => (state.row !== null && state.row.tokenHash === hash ? state.row : null),
      updateAccessToken: async (id, sealed, expiresAt) => {
        state.updates.push({ id, sealed, expiresAt });
      },
      delete: async (hash) => {
        state.deleted.push(hash);
      },
      deleteAll: async (id) => {
        state.deletedAll.push(id);
      },
    },
  };
  return { deps, state, cognito, getCognito, getSessionKey, revoke };
}

function rowFor(token: string, overrides: Partial<Row> = {}): Row {
  return {
    id: 's1',
    tokenHash: sha(token),
    customerId: 'c1',
    refreshTokenSealed: encryptSecret('R', key),
    accessTokenSealed: encryptSecret('A', key),
    accessTokenExpiresAt: new Date(NOW.getTime() + 60_000),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    customer,
    ...overrides,
  };
}

describe('startCustomerSession', () => {
  it('stores only the hash, seals the tokens and expires in 7 days', async () => {
    const { deps, state } = build(null);
    const out = await startCustomerSession(deps, {
      customerId: 'c1',
      tokens: { accessToken: 'A', idToken: 'I', refreshToken: 'R', accessExpiresAt: new Date(NOW.getTime() + 900_000) },
      now: NOW,
    });
    expect(out.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(out.expiresAt).toEqual(new Date(NOW.getTime() + 7 * 86_400_000));
    const inserted = state.inserted[0] as Row;
    expect(inserted.tokenHash).toBe(sha(out.token));
    expect(JSON.stringify(inserted)).not.toContain(out.token);
    expect(decryptSecret(inserted.refreshTokenSealed, key)).toBe('R');
    expect(decryptSecret(inserted.accessTokenSealed, key)).toBe('A');
    expect(inserted.accessTokenExpiresAt).toEqual(new Date(NOW.getTime() + 900_000));
  });
});

describe('readCustomerSession', () => {
  it('no cookie never reads auth config', async () => {
    const { deps, getCognito, getSessionKey } = build(null);
    expect(await readCustomerSession(deps, undefined, NOW)).toBeNull();
    expect(getCognito).not.toHaveBeenCalled();
    expect(getSessionKey).not.toHaveBeenCalled();
  });

  it('valid session within access lifetime does not refresh', async () => {
    const { deps, cognito, getCognito } = build(rowFor('tok'));
    expect(await readCustomerSession(deps, 'tok', NOW)).toEqual({ id: 'c1', firstName: 'Som', email: 'a@b.co' });
    expect(cognito.refresh).not.toHaveBeenCalled();
    expect(getCognito).not.toHaveBeenCalled();
  });

  it('an unknown token is signed out', async () => {
    const { deps } = build(rowFor('tok'));
    expect(await readCustomerSession(deps, 'other', NOW)).toBeNull();
  });

  it('expired access token refreshes and stores the new expiry', async () => {
    const { deps, cognito, state } = build(rowFor('tok', { accessTokenExpiresAt: new Date(NOW.getTime() - 1) }));
    expect(await readCustomerSession(deps, 'tok', NOW)).toEqual({ id: 'c1', firstName: 'Som', email: 'a@b.co' });
    expect(cognito.refresh).toHaveBeenCalledWith({ sub: 'sub-1', refreshToken: 'R' });
    const update = state.updates[0] as { id: string; sealed: string; expiresAt: Date };
    expect(update.id).toBe('s1');
    expect(update.expiresAt).toEqual(new Date(NOW.getTime() + 900_000));
    expect(decryptSecret(update.sealed, key)).toBe('A2');
  });

  it('two concurrent refreshes both succeed', async () => {
    const { deps, state } = build(rowFor('tok', { accessTokenExpiresAt: new Date(NOW.getTime() - 1) }));
    const [a, b] = await Promise.all([readCustomerSession(deps, 'tok', NOW), readCustomerSession(deps, 'tok', NOW)]);
    expect(a?.id).toBe('c1');
    expect(b?.id).toBe('c1');
    expect(state.deleted).toEqual([]);
    expect(state.updates).toHaveLength(2);
  });

  it.each<CognitoErrorCode>(['not_authorized', 'user_not_confirmed'])('refresh rejected (%s) deletes the session', async (code) => {
    const { deps, state } = build(rowFor('tok', { accessTokenExpiresAt: new Date(NOW.getTime() - 1) }), async () => {
      throw new CognitoError(code);
    });
    expect(await readCustomerSession(deps, 'tok', NOW)).toBeNull();
    expect(state.deleted).toEqual([sha('tok')]);
  });

  it.each<CognitoErrorCode>(['unavailable', 'limit_exceeded'])('refresh %s keeps the session and returns null', async (code) => {
    const { deps, state } = build(rowFor('tok', { accessTokenExpiresAt: new Date(NOW.getTime() - 1) }), async () => {
      throw new CognitoError(code);
    });
    expect(await readCustomerSession(deps, 'tok', NOW)).toBeNull();
    expect(state.deleted).toEqual([]);
  });

  it('an unexpected error keeps the session, returns null and logs only the customer id', async () => {
    const log = vi.fn();
    const { deps, state } = build(rowFor('tok', { accessTokenExpiresAt: new Date(NOW.getTime() - 1) }), async () => {
      throw new Error('boom with secret-ish text');
    });
    expect(await readCustomerSession({ ...deps, log }, 'tok', NOW)).toBeNull();
    expect(state.deleted).toEqual([]);
    expect(JSON.stringify(log.mock.calls)).toContain('c1');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-ish');
  });

  it('past expires_at deletes the session without calling Cognito', async () => {
    const { deps, state, getCognito, cognito } = build(
      rowFor('tok', { expiresAt: new Date(NOW.getTime() - 1), accessTokenExpiresAt: new Date(NOW.getTime() - 1) }),
    );
    expect(await readCustomerSession(deps, 'tok', NOW)).toBeNull();
    expect(state.deleted).toEqual([sha('tok')]);
    expect(getCognito).not.toHaveBeenCalled();
    expect(cognito.refresh).not.toHaveBeenCalled();
  });
});

describe('ending sessions', () => {
  it('endCustomerSession deletes the row and revokes the refresh token', async () => {
    const { deps, state, revoke } = build(rowFor('tok'));
    await endCustomerSession(deps, 'tok');
    expect(state.deleted).toEqual([sha('tok')]);
    expect(revoke).toHaveBeenCalledWith('R');
  });

  it('endCustomerSession still deletes when the revoke fails', async () => {
    const { deps, state, revoke } = build(rowFor('tok'));
    revoke.mockRejectedValueOnce(new CognitoError('unavailable'));
    await expect(endCustomerSession(deps, 'tok')).resolves.toBeUndefined();
    expect(state.deleted).toEqual([sha('tok')]);
  });

  it('endAllCustomerSessions deletes every row of the customer', async () => {
    const { deps, state } = build(null);
    await endAllCustomerSessions(deps, 'c1');
    expect(state.deletedAll).toEqual(['c1']);
  });
});
