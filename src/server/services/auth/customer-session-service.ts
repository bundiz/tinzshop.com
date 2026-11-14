import { createHash, randomBytes } from 'node:crypto';

import { decryptSecret, encryptSecret } from '@/lib/secret-box';

import type { PermissionKey, RoleKey } from '@/server/services/access/permission-keys';

import type { CognitoIdentity, CognitoTokens } from './cognito-identity';

export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export type CurrentCustomer = {
  id: string;
  firstName: string;
  email: string;
  roleKey: RoleKey;
  permissions: readonly PermissionKey[];
};

type SessionRow = {
  id: string;
  tokenHash: string;
  customerId: string;
  refreshTokenSealed: string;
  accessTokenSealed: string;
  accessTokenExpiresAt: Date;
  expiresAt: Date;
};

type NewSessionRow = Omit<SessionRow, 'id'>;

export type CustomerSessionDeps = {
  /** Called only when Cognito is needed, so a request with no cookie never reads auth config. */
  getCognito(): Pick<CognitoIdentity, 'refresh' | 'revokeRefreshToken'>;
  getSessionKey(): Buffer;
  sessions: {
    insert(row: NewSessionRow): Promise<void>;
    find(
      tokenHash: string,
    ): Promise<(SessionRow & { customer: {
          id: string;
          cognitoSub: string;
          email: string;
          firstName: string;
          roleKey: RoleKey;
          permissions: readonly PermissionKey[];
          blockedAt: Date | null;
        };
      }) | null>;
    updateAccessToken(id: string, sealed: string, expiresAt: Date): Promise<void>;
    delete(tokenHash: string): Promise<void>;
    deleteAll(customerId: string): Promise<void>;
  };
  /** Receives a message, a customer id and at most a Cognito failure code: never a token, cookie value or email. */
  log?: (message: string, fields: { customerId: string; code?: string }) => void;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function errorCode(error: unknown): string | null {
  if (error instanceof Error && error.name === 'CognitoError') {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/** Creates the session row after a sign-in. Returns the raw cookie value; only its hash is stored. */
export async function startCustomerSession(
  deps: CustomerSessionDeps,
  input: { customerId: string; tokens: CognitoTokens; now: Date },
): Promise<{ token: string; expiresAt: Date }> {
  const key = deps.getSessionKey();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(input.now.getTime() + SESSION_LIFETIME_MS);
  await deps.sessions.insert({
    tokenHash: hashToken(token),
    customerId: input.customerId,
    refreshTokenSealed: encryptSecret(input.tokens.refreshToken, key),
    accessTokenSealed: encryptSecret(input.tokens.accessToken, key),
    accessTokenExpiresAt: input.tokens.accessExpiresAt,
    expiresAt,
  });
  return { token, expiresAt };
}

/**
 * The signed-in customer for this cookie, or null. Refreshes the access token silently when it has
 * lapsed. A definite rejection deletes the session; Cognito being unreachable keeps it.
 */
export async function readCustomerSession(
  deps: CustomerSessionDeps,
  token: string | undefined,
  now: Date,
): Promise<CurrentCustomer | null> {
  if (token === undefined || token === '') return null;
  const tokenHash = hashToken(token);
  const row = await deps.sessions.find(tokenHash);
  if (row === null) return null;

  if (row.expiresAt.getTime() <= now.getTime()) {
    await deps.sessions.delete(tokenHash);
    return null;
  }

  // A blocked account is signed out on its next request, whatever its token says (spec §6).
  if (row.customer.blockedAt !== null) {
    await deps.sessions.delete(tokenHash);
    return null;
  }

  const current: CurrentCustomer = {
    id: row.customer.id,
    firstName: row.customer.firstName,
    email: row.customer.email,
    roleKey: row.customer.roleKey,
    permissions: row.customer.permissions,
  };
  if (row.accessTokenExpiresAt.getTime() > now.getTime()) return current;

  try {
    const key = deps.getSessionKey();
    const refreshToken = decryptSecret(row.refreshTokenSealed, key);
    // Refresh-token rotation is off, so two requests refreshing at once is harmless: both write.
    const refreshed = await deps.getCognito().refresh({ sub: row.customer.cognitoSub, refreshToken });
    await deps.sessions.updateAccessToken(row.id, encryptSecret(refreshed.accessToken, key), refreshed.accessExpiresAt);
    return current;
  } catch (error) {
    const code = errorCode(error);
    if (code === 'not_authorized' || code === 'user_not_confirmed') {
      await deps.sessions.delete(tokenHash);
      return null;
    }
    // Cognito unreachable or throttling: the row is kept and this request is signed out. Logged so a lasting
    // outage shows up (spec §7); a definite rejection above is an ordinary sign-out and is not.
    if (code === null) deps.log?.('customer session refresh failed unexpectedly', { customerId: row.customerId });
    else deps.log?.('customer session refresh failed', { customerId: row.customerId, code });
    return null;
  }
}

/** Signs out this device: deletes the row first, then revokes the refresh token as far as possible. */
export async function endCustomerSession(deps: CustomerSessionDeps, token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const row = await deps.sessions.find(tokenHash);
  await deps.sessions.delete(tokenHash);
  if (row === null) return;
  try {
    const refreshToken = decryptSecret(row.refreshTokenSealed, deps.getSessionKey());
    await deps.getCognito().revokeRefreshToken(refreshToken);
  } catch {
    // The row is already gone, so this device is signed out; a failed revoke only leaves the token to expire.
    deps.log?.('refresh token revoke failed', { customerId: row.customerId });
  }
}

/** Signs a customer out everywhere (password reset, and later password or email changes). */
export async function endAllCustomerSessions(deps: CustomerSessionDeps, customerId: string): Promise<void> {
  await deps.sessions.deleteAll(customerId);
}
