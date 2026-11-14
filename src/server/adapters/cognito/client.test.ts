import { describe, expect, it } from 'vitest';

import { createCognitoIdentity } from './client';
import { CognitoError } from './errors';

const config = {
  region: 'ap-southeast-1',
  userPoolId: 'ap-southeast-1_AbCdEf123',
  clientId: 'client-id-123',
  clientSecret: 'client-secret-value',
  domain: 'example.auth.ap-southeast-1.amazoncognito.com',
};

type Sent = { name: string; input: Record<string, unknown> };

function fakeSend(respond: (sent: Sent) => unknown) {
  const sent: Sent[] = [];
  const send = async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
    const record = { name: command.constructor.name, input: command.input };
    sent.push(record);
    return respond(record);
  };
  return { send, sent };
}

function sdkError(name: string, status = 400, message = 'x'): Error {
  return Object.assign(new Error(message), { name, $metadata: { httpStatusCode: status } });
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(CognitoError);
    return (error as CognitoError).code;
  }
  return 'no error';
}

const NOW = new Date('2026-11-10T00:00:00Z');

describe('createCognitoIdentity: errors', () => {
  it.each([
    ['UsernameExistsException', 'username_exists'],
    ['CodeMismatchException', 'code_mismatch'],
    ['ExpiredCodeException', 'code_expired'],
    ['NotAuthorizedException', 'not_authorized'],
    ['UserNotFoundException', 'not_authorized'],
    ['UserNotConfirmedException', 'user_not_confirmed'],
    ['InvalidPasswordException', 'invalid_password'],
    ['LimitExceededException', 'limit_exceeded'],
    ['TooManyRequestsException', 'limit_exceeded'],
    ['TooManyFailedAttemptsException', 'limit_exceeded'],
  ])('maps %s to %s', async (name, code) => {
    const { send } = fakeSend(() => {
      throw sdkError(name);
    });
    const cognito = createCognitoIdentity(config, { send });
    expect(await codeOf(cognito.resendConfirmationCode({ email: 'a@b.co' }))).toBe(code);
  });

  it('maps a confirmed-already message to already_confirmed', async () => {
    const { send } = fakeSend(() => {
      throw sdkError('NotAuthorizedException', 400, 'User cannot be confirmed. Current status is CONFIRMED');
    });
    const cognito = createCognitoIdentity(config, { send });
    expect(await codeOf(cognito.confirmSignUp({ email: 'a@b.co', code: '123456' }))).toBe('already_confirmed');
  });

  it('maps a thrown network error and a 5xx to unavailable', async () => {
    const network = createCognitoIdentity(config, {
      send: async () => {
        throw new TypeError('fetch failed');
      },
    });
    expect(await codeOf(network.forgotPassword({ email: 'a@b.co' }))).toBe('unavailable');
    const fiveHundred = createCognitoIdentity(config, {
      send: async () => {
        throw sdkError('InternalErrorException', 500);
      },
    });
    expect(await codeOf(fiveHundred.forgotPassword({ email: 'a@b.co' }))).toBe('unavailable');
  });

  it('never puts the email, password or code in the error message', async () => {
    const { send } = fakeSend(() => {
      throw sdkError('CodeMismatchException', 400, 'bad code 123456 for a@b.co');
    });
    const cognito = createCognitoIdentity(config, { send });
    try {
      await cognito.confirmSignUp({ email: 'a@b.co', code: '123456' });
    } catch (error) {
      expect((error as Error).message).not.toContain('123456');
      expect((error as Error).message).not.toContain('a@b.co');
    }
  });
});

describe('createCognitoIdentity: calls', () => {
  it('signs in with USER_PASSWORD_AUTH and a SECRET_HASH, and returns the expiry from ExpiresIn', async () => {
    const { send, sent } = fakeSend(() => ({
      AuthenticationResult: { AccessToken: 'A', IdToken: 'I', RefreshToken: 'R', ExpiresIn: 900 },
    }));
    const cognito = createCognitoIdentity(config, { send, now: () => NOW });
    const tokens = await cognito.signInWithPassword({ email: 'a@b.co', password: 'pw' });
    expect(tokens).toEqual({
      accessToken: 'A',
      idToken: 'I',
      refreshToken: 'R',
      accessExpiresAt: new Date(NOW.getTime() + 900_000),
    });
    expect(sent[0]?.name).toBe('InitiateAuthCommand');
    expect(sent[0]?.input).toMatchObject({ AuthFlow: 'USER_PASSWORD_AUTH', ClientId: 'client-id-123' });
    expect((sent[0]?.input.AuthParameters as Record<string, string>).SECRET_HASH).toMatch(/=$/);
    expect((sent[0]?.input.AuthParameters as Record<string, string>).USERNAME).toBe('a@b.co');
  });

  it('refreshes with REFRESH_TOKEN_AUTH using the sub as the SECRET_HASH username', async () => {
    const { send, sent } = fakeSend(() => ({ AuthenticationResult: { AccessToken: 'A2', IdToken: 'I2', ExpiresIn: 600 } }));
    const cognito = createCognitoIdentity(config, { send, now: () => NOW });
    const out = await cognito.refresh({ sub: 'sub-1', refreshToken: 'R' });
    expect(out).toEqual({ accessToken: 'A2', idToken: 'I2', accessExpiresAt: new Date(NOW.getTime() + 600_000) });
    expect(sent[0]?.input).toMatchObject({ AuthFlow: 'REFRESH_TOKEN_AUTH' });
    const params = sent[0]?.input.AuthParameters as Record<string, string>;
    expect(params.REFRESH_TOKEN).toBe('R');
    expect(params.SECRET_HASH).toBeDefined();
  });

  it('signs up with the names as attributes and revokes with the client secret', async () => {
    const { send, sent } = fakeSend(() => ({}));
    const cognito = createCognitoIdentity(config, { send });
    await cognito.signUp({ email: 'a@b.co', password: 'pw', firstName: 'Som', lastName: 'Chai' });
    await cognito.revokeRefreshToken('R');
    expect(sent.map((s) => s.name)).toEqual(['SignUpCommand', 'RevokeTokenCommand']);
    expect(sent[0]?.input.UserAttributes).toEqual(
      expect.arrayContaining([
        { Name: 'email', Value: 'a@b.co' },
        { Name: 'given_name', Value: 'Som' },
        { Name: 'family_name', Value: 'Chai' },
      ]),
    );
    expect(sent[1]?.input).toMatchObject({ Token: 'R', ClientId: 'client-id-123', ClientSecret: 'client-secret-value' });
  });

  it('treats a sign-in challenge as not_authorized', async () => {
    const { send } = fakeSend(() => ({ ChallengeName: 'NEW_PASSWORD_REQUIRED' }));
    const cognito = createCognitoIdentity(config, { send });
    expect(await codeOf(cognito.signInWithPassword({ email: 'a@b.co', password: 'pw' }))).toBe('not_authorized');
  });
});

describe('createCognitoIdentity: OAuth', () => {
  it('builds a Google authorize URL with PKCE and the three scopes', () => {
    const cognito = createCognitoIdentity(config, { send: async () => ({}) });
    const url = new URL(
      cognito.googleAuthorizeUrl({ state: 'st', codeChallenge: 'ch', redirectUri: 'http://localhost:3002/api/callbacks/cognito' }),
    );
    expect(url.origin + url.pathname).toBe(`https://${config.domain}/oauth2/authorize`);
    expect(url.searchParams.get('identity_provider')).toBe('Google');
    // Google always shows its account chooser, so a signed-out customer is never signed straight back in (D-206).
    expect(url.searchParams.get('prompt')).toBe('select_account');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('ch');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('client_id')).toBe('client-id-123');
  });

  it('exchanges a code with Basic auth and the verifier', async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ access_token: 'A', id_token: 'I', refresh_token: 'R', expires_in: 900 }), { status: 200 });
    }) as unknown as typeof fetch;
    const cognito = createCognitoIdentity(config, { send: async () => ({}), fetch: fetchImpl, now: () => NOW });
    const tokens = await cognito.exchangeCode({ code: 'c', codeVerifier: 'v', redirectUri: 'http://x/cb' });
    expect(tokens.accessExpiresAt).toEqual(new Date(NOW.getTime() + 900_000));
    expect(requests[0]?.url).toBe(`https://${config.domain}/oauth2/token`);
    const headers = requests[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('client-id-123:client-secret-value').toString('base64')}`);
    const body = new URLSearchParams(String(requests[0]?.init.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBe('v');
  });

  it('maps invalid_grant to not_authorized and a 5xx or network failure to unavailable', async () => {
    const make = (impl: () => Promise<Response>) =>
      createCognitoIdentity(config, { send: async () => ({}), fetch: impl as unknown as typeof fetch });
    const input = { code: 'c', codeVerifier: 'v', redirectUri: 'http://x/cb' };
    expect(await codeOf(make(async () => new Response('{"error":"invalid_grant"}', { status: 400 })).exchangeCode(input))).toBe('not_authorized');
    expect(await codeOf(make(async () => new Response('', { status: 503 })).exchangeCode(input))).toBe('unavailable');
    expect(
      await codeOf(
        make(async () => {
          throw new TypeError('fetch failed');
        }).exchangeCode(input),
      ),
    ).toBe('unavailable');
  });

  it('verifies the ID token through the verifier and reads the claims', async () => {
    const cognito = createCognitoIdentity(config, {
      send: async () => ({}),
      verifyJwt: async () => ({ sub: 's1', email: 'a@b.co', given_name: 'Som' }),
    });
    expect(await cognito.verifyIdToken('t')).toEqual({ sub: 's1', email: 'a@b.co', givenName: 'Som', familyName: null });
    const bad = createCognitoIdentity(config, {
      send: async () => ({}),
      verifyJwt: async () => {
        throw new Error('bad signature');
      },
    });
    expect(await codeOf(bad.verifyIdToken('t'))).toBe('not_authorized');
  });
});
