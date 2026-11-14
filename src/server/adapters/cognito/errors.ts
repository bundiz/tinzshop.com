export type CognitoErrorCode =
  | 'username_exists'
  | 'code_mismatch'
  | 'code_expired'
  | 'already_confirmed'
  | 'not_authorized'
  | 'user_not_confirmed'
  | 'invalid_password'
  | 'limit_exceeded'
  | 'unavailable';

/**
 * Every failure of a Cognito call. The message is the code only: never an email, password,
 * verification code, token or Cognito's own text.
 */
export class CognitoError extends Error {
  readonly code: CognitoErrorCode;

  constructor(code: CognitoErrorCode) {
    super(`cognito: ${code}`);
    this.name = 'CognitoError';
    this.code = code;
  }
}

export function isCognitoError(error: unknown): error is CognitoError {
  return error instanceof Error && error.name === 'CognitoError' && typeof (error as CognitoError).code === 'string';
}
