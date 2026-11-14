import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  RevokeTokenCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

import type { CognitoIdentity, CognitoTokens } from '@/server/services/auth/cognito-identity';

import { CognitoError, type CognitoErrorCode } from './errors';
import { secretHash } from './secret-hash';

export type CognitoAdapterConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
  clientSecret: string;
  /** Full host name of the Cognito domain, no scheme. */
  domain: string;
};

type SdkCommand = { input: unknown };

export type CognitoAdapterOptions = {
  /** Sends one SDK command. Defaults to a real client; tests inject a fake. */
  send?: (command: never) => Promise<unknown>;
  fetch?: typeof fetch;
  now?: () => Date;
  /** Verifies an ID token and returns its claims. Defaults to aws-jwt-verify. */
  verifyJwt?: (idToken: string) => Promise<Record<string, unknown>>;
};

const SCOPES = 'openid email profile';

const EXCEPTION_CODES: Readonly<Record<string, CognitoErrorCode>> = {
  UsernameExistsException: 'username_exists',
  CodeMismatchException: 'code_mismatch',
  ExpiredCodeException: 'code_expired',
  NotAuthorizedException: 'not_authorized',
  UserNotFoundException: 'not_authorized',
  UserNotConfirmedException: 'user_not_confirmed',
  InvalidPasswordException: 'invalid_password',
  LimitExceededException: 'limit_exceeded',
  TooManyRequestsException: 'limit_exceeded',
  TooManyFailedAttemptsException: 'limit_exceeded',
};

/** Turns anything an SDK call throws into a CognitoError. Nothing from the original error is kept. */
function toCognitoError(error: unknown): CognitoError {
  if (error instanceof CognitoError) return error;
  const e = error as { name?: unknown; message?: unknown; $metadata?: { httpStatusCode?: number } } | null;
  const status = e?.$metadata?.httpStatusCode;
  if (typeof status === 'number' && status >= 500) return new CognitoError('unavailable');
  const name = typeof e?.name === 'string' ? e.name : '';
  const message = typeof e?.message === 'string' ? e.message : '';
  if (/already confirmed|status is CONFIRMED/i.test(message) && (name === 'NotAuthorizedException' || name === 'InvalidParameterException')) {
    return new CognitoError('already_confirmed');
  }
  const code = EXCEPTION_CODES[name];
  // Network failures and any exception we do not know are treated as Cognito being unavailable.
  return new CognitoError(code ?? 'unavailable');
}

function defaultSend(config: CognitoAdapterConfig): (command: never) => Promise<unknown> {
  // These are public APIs authorised by client id and SECRET_HASH. The placeholder keeps the SDK
  // from searching the environment for AWS credentials; it is never used to sign these calls.
  const client = new CognitoIdentityProviderClient({
    region: config.region,
    credentials: async () => ({ accessKeyId: 'anonymous', secretAccessKey: 'anonymous' }),
  });
  return (command) => client.send(command as never);
}

export function createCognitoIdentity(config: CognitoAdapterConfig, options: CognitoAdapterOptions = {}): CognitoIdentity {
  const send = options.send ?? defaultSend(config);
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());

  const hash = (username: string) =>
    secretHash({ clientSecret: config.clientSecret, clientId: config.clientId, username });

  async function call<T>(command: SdkCommand): Promise<T> {
    try {
      return (await send(command as never)) as T;
    } catch (error) {
      throw toCognitoError(error);
    }
  }

  const expiryFrom = (expiresInSeconds: number | undefined): Date => {
    if (typeof expiresInSeconds !== 'number' || !Number.isFinite(expiresInSeconds)) {
      throw new CognitoError('unavailable');
    }
    return new Date(now().getTime() + expiresInSeconds * 1000);
  };

  type AuthResponse = {
    ChallengeName?: string;
    AuthenticationResult?: { AccessToken?: string; IdToken?: string; RefreshToken?: string; ExpiresIn?: number };
  };

  async function verifyDefault(idToken: string): Promise<Record<string, unknown>> {
    const verifier = CognitoJwtVerifier.create({
      userPoolId: config.userPoolId,
      tokenUse: 'id',
      clientId: config.clientId,
    });
    return (await verifier.verify(idToken)) as unknown as Record<string, unknown>;
  }
  const verifyJwt = options.verifyJwt ?? verifyDefault;

  async function tokenRequest(body: URLSearchParams): Promise<CognitoTokens> {
    let response: Response;
    try {
      response = await doFetch(`https://${config.domain}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        },
        body: body.toString(),
      });
    } catch {
      throw new CognitoError('unavailable');
    }
    if (response.status >= 500) throw new CognitoError('unavailable');
    if (!response.ok) throw new CognitoError('not_authorized');
    let json: { access_token?: unknown; id_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
    try {
      json = (await response.json()) as typeof json;
    } catch {
      throw new CognitoError('unavailable');
    }
    if (
      typeof json.access_token !== 'string' ||
      typeof json.id_token !== 'string' ||
      typeof json.refresh_token !== 'string'
    ) {
      throw new CognitoError('unavailable');
    }
    return {
      accessToken: json.access_token,
      idToken: json.id_token,
      refreshToken: json.refresh_token,
      accessExpiresAt: expiryFrom(typeof json.expires_in === 'number' ? json.expires_in : undefined),
    };
  }

  return {
    async signUp({ email, password, firstName, lastName }) {
      await call(
        new SignUpCommand({
          ClientId: config.clientId,
          SecretHash: hash(email),
          Username: email,
          Password: password,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'given_name', Value: firstName },
            { Name: 'family_name', Value: lastName },
          ],
        }),
      );
    },

    async confirmSignUp({ email, code }) {
      await call(
        new ConfirmSignUpCommand({
          ClientId: config.clientId,
          SecretHash: hash(email),
          Username: email,
          ConfirmationCode: code,
        }),
      );
    },

    async resendConfirmationCode({ email }) {
      await call(
        new ResendConfirmationCodeCommand({ ClientId: config.clientId, SecretHash: hash(email), Username: email }),
      );
    },

    async signInWithPassword({ email, password }) {
      const out = await call<AuthResponse>(
        new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: config.clientId,
          AuthParameters: { USERNAME: email, PASSWORD: password, SECRET_HASH: hash(email) },
        }),
      );
      const result = out.AuthenticationResult;
      // A challenge (for example a forced password change) is not a flow this app supports.
      if (!result?.AccessToken || !result.IdToken || !result.RefreshToken) throw new CognitoError('not_authorized');
      return {
        accessToken: result.AccessToken,
        idToken: result.IdToken,
        refreshToken: result.RefreshToken,
        accessExpiresAt: expiryFrom(result.ExpiresIn),
      };
    },

    async refresh({ sub, refreshToken }) {
      const out = await call<AuthResponse>(
        new InitiateAuthCommand({
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          ClientId: config.clientId,
          AuthParameters: { REFRESH_TOKEN: refreshToken, SECRET_HASH: hash(sub) },
        }),
      );
      const result = out.AuthenticationResult;
      if (!result?.AccessToken || !result.IdToken) throw new CognitoError('not_authorized');
      return { accessToken: result.AccessToken, idToken: result.IdToken, accessExpiresAt: expiryFrom(result.ExpiresIn) };
    },

    async forgotPassword({ email }) {
      await call(new ForgotPasswordCommand({ ClientId: config.clientId, SecretHash: hash(email), Username: email }));
    },

    async confirmForgotPassword({ email, code, newPassword }) {
      await call(
        new ConfirmForgotPasswordCommand({
          ClientId: config.clientId,
          SecretHash: hash(email),
          Username: email,
          ConfirmationCode: code,
          Password: newPassword,
        }),
      );
    },

    async revokeRefreshToken(refreshToken) {
      await call(
        new RevokeTokenCommand({ Token: refreshToken, ClientId: config.clientId, ClientSecret: config.clientSecret }),
      );
    },

    googleAuthorizeUrl({ state, codeChallenge, redirectUri }) {
      const url = new URL(`https://${config.domain}/oauth2/authorize`);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('scope', SCOPES);
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('identity_provider', 'Google');
      // Cognito forwards this to Google, which then always shows its account chooser: after signing out on a shared
      // computer, the next person is never signed straight back in as the last one (D-226).
      url.searchParams.set('prompt', 'select_account');
      return url.toString();
    },

    exchangeCode({ code, codeVerifier, redirectUri }) {
      return tokenRequest(
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      );
    },

    async verifyIdToken(idToken) {
      let claims: Record<string, unknown>;
      try {
        claims = await verifyJwt(idToken);
      } catch {
        throw new CognitoError('not_authorized');
      }
      const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
      const sub = str(claims.sub);
      const email = str(claims.email);
      if (sub === null || email === null) throw new CognitoError('not_authorized');
      return { sub, email, givenName: str(claims.given_name), familyName: str(claims.family_name) };
    },
  };
}
