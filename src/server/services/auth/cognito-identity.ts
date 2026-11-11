/** What the auth services need from Cognito. `src/server/adapters/cognito/` implements it. */

export type CognitoFailureCode =
  | 'username_exists'
  | 'code_mismatch'
  | 'code_expired'
  | 'already_confirmed'
  | 'not_authorized'
  | 'user_not_confirmed'
  | 'invalid_password'
  | 'limit_exceeded'
  | 'unavailable';

const FAILURE_CODES: ReadonlySet<string> = new Set<CognitoFailureCode>([
  'username_exists',
  'code_mismatch',
  'code_expired',
  'already_confirmed',
  'not_authorized',
  'user_not_confirmed',
  'invalid_password',
  'limit_exceeded',
  'unavailable',
]);

/**
 * True for the error the Cognito adapter throws (`CognitoError`), recognised by name and code so
 * services never import the adapter. Anything else is a bug and must propagate (D-022).
 */
export function isCognitoError(error: unknown): error is Error & { code: CognitoFailureCode } {
  return (
    error instanceof Error &&
    error.name === 'CognitoError' &&
    FAILURE_CODES.has((error as { code?: unknown }).code as string)
  );
}

export type CognitoTokens = {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
};

export type RefreshedTokens = {
  accessToken: string;
  idToken: string;
  accessExpiresAt: Date;
};

export type VerifiedIdentity = {
  sub: string;
  email: string;
  givenName: string | null;
  familyName: string | null;
};

export interface CognitoIdentity {
  signUp(input: { email: string; password: string; firstName: string; lastName: string }): Promise<void>;
  confirmSignUp(input: { email: string; code: string }): Promise<void>;
  resendConfirmationCode(input: { email: string }): Promise<void>;
  signInWithPassword(input: { email: string; password: string }): Promise<CognitoTokens>;
  refresh(input: { sub: string; refreshToken: string }): Promise<RefreshedTokens>;
  forgotPassword(input: { email: string }): Promise<void>;
  confirmForgotPassword(input: { email: string; code: string; newPassword: string }): Promise<void>;
  revokeRefreshToken(refreshToken: string): Promise<void>;
  googleAuthorizeUrl(input: { state: string; codeChallenge: string; redirectUri: string }): string;
  exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<CognitoTokens>;
  verifyIdToken(idToken: string): Promise<VerifiedIdentity>;
}
