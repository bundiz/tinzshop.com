import { describe, expect, it } from 'vitest';
import { createPreSignUpHandler } from './index.mjs';

const POOL = 'pool-under-test';

/** A fake Cognito client: records every command, answers ListUsers from `users`. */
function fakeCognito(users = []) {
  const calls = [];
  return {
    calls,
    async send(command) {
      const name = command.constructor.name;
      calls.push({ name, input: command.input });
      if (name === 'ListUsersCommand') return { Users: users };
      if (name === 'AdminCreateUserCommand') {
        return { User: { Username: 'created-user-id' } };
      }
      return {};
    },
  };
}

function googleEvent(attrs = {}, userName = 'google_1234567890') {
  return {
    triggerSource: 'PreSignUp_ExternalProvider',
    userPoolId: POOL,
    userName,
    request: {
      userAttributes: {
        email: 'Somchai@Example.com',
        email_verified: 'true',
        given_name: 'Somchai',
        family_name: 'Example',
        ...attrs,
      },
    },
    response: {},
  };
}

const nativeUser = (over = {}) => ({
  Username: 'native-user-id',
  UserStatus: 'CONFIRMED',
  Attributes: [
    { Name: 'email', Value: 'somchai@example.com' },
    { Name: 'email_verified', Value: 'true' },
  ],
  ...over,
});

const names = (c) => c.calls.map((x) => x.name);

describe('pre sign-up trigger', () => {
  it('rejects a Google email that is not verified', async () => {
    const cognito = fakeCognito();
    const handler = createPreSignUpHandler({ cognito });
    await expect(handler(googleEvent({ email_verified: 'false' }))).rejects.toThrow();
    await expect(handler(googleEvent({ email_verified: undefined }))).rejects.toThrow();
    expect(cognito.calls).toEqual([]);
  });

  it('links to an existing verified user', async () => {
    const cognito = fakeCognito([nativeUser()]);
    const event = googleEvent();
    const result = await createPreSignUpHandler({ cognito })(event);
    expect(result).toBe(event);
    expect(names(cognito)).toEqual(['ListUsersCommand', 'AdminLinkProviderForUserCommand']);
    expect(cognito.calls[0].input).toMatchObject({
      UserPoolId: POOL,
      Filter: 'email = "somchai@example.com"',
    });
    expect(cognito.calls[1].input).toEqual({
      UserPoolId: POOL,
      DestinationUser: { ProviderName: 'Cognito', ProviderAttributeValue: 'native-user-id' },
      SourceUser: {
        ProviderName: 'Google',
        ProviderAttributeName: 'Cognito_Subject',
        ProviderAttributeValue: '1234567890',
      },
    });
  });

  it('deletes an unverified user, then creates and links', async () => {
    const cognito = fakeCognito([
      nativeUser({
        UserStatus: 'UNCONFIRMED',
        Attributes: [
          { Name: 'email', Value: 'somchai@example.com' },
          { Name: 'email_verified', Value: 'false' },
        ],
      }),
    ]);
    await createPreSignUpHandler({ cognito })(googleEvent());
    expect(names(cognito)).toEqual([
      'ListUsersCommand',
      'AdminDeleteUserCommand',
      'AdminCreateUserCommand',
      'AdminSetUserPasswordCommand',
      'AdminLinkProviderForUserCommand',
    ]);
    expect(cognito.calls[1].input).toEqual({ UserPoolId: POOL, Username: 'native-user-id' });
  });

  it('creates a confirmed user with Google names and an unusable random password, then links', async () => {
    const cognito = fakeCognito([]);
    await createPreSignUpHandler({ cognito })(googleEvent());
    expect(names(cognito)).toEqual([
      'ListUsersCommand',
      'AdminCreateUserCommand',
      'AdminSetUserPasswordCommand',
      'AdminLinkProviderForUserCommand',
    ]);
    const create = cognito.calls[1].input;
    expect(create.UserPoolId).toBe(POOL);
    expect(create.Username).toBe('somchai@example.com');
    expect(create.MessageAction).toBe('SUPPRESS');
    expect(create.UserAttributes).toEqual(
      expect.arrayContaining([
        { Name: 'email', Value: 'somchai@example.com' },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: 'Somchai' },
        { Name: 'family_name', Value: 'Example' },
      ]),
    );
    const setPw = cognito.calls[2].input;
    expect(setPw.Username).toBe('created-user-id');
    expect(setPw.Permanent).toBe(true);
    expect(setPw.Password.length).toBeGreaterThanOrEqual(43);
    expect(setPw.Password).toMatch(/[a-z]/);
    expect(setPw.Password).toMatch(/[A-Z]/);
    expect(setPw.Password).toMatch(/[0-9]/);
    expect(setPw.Password).toMatch(/[^A-Za-z0-9]/);
    // Two runs give two different passwords.
    const other = fakeCognito([]);
    await createPreSignUpHandler({ cognito: other })(googleEvent());
    expect(other.calls[2].input.Password).not.toBe(setPw.Password);
    // The link targets the created user's real Username.
    expect(cognito.calls[3].input.DestinationUser.ProviderAttributeValue).toBe('created-user-id');
  });

  it('passes ordinary sign-ups through unchanged', async () => {
    for (const triggerSource of ['PreSignUp_SignUp', 'PreSignUp_AdminCreateUser']) {
      const cognito = fakeCognito();
      const event = { ...googleEvent(), triggerSource };
      const result = await createPreSignUpHandler({ cognito })(event);
      expect(result).toBe(event);
      expect(cognito.calls).toEqual([]);
    }
  });

  it('matches the email case-insensitively', async () => {
    const cognito = fakeCognito([
      nativeUser({
        Attributes: [
          { Name: 'email', Value: 'SOMCHAI@EXAMPLE.COM' },
          { Name: 'email_verified', Value: 'true' },
        ],
      }),
    ]);
    await createPreSignUpHandler({ cognito })(googleEvent({ email: 'SomChai@Example.COM' }, 'Google_42'));
    expect(cognito.calls[0].input.Filter).toBe('email = "somchai@example.com"');
    expect(names(cognito)).toEqual(['ListUsersCommand', 'AdminLinkProviderForUserCommand']);
    expect(cognito.calls[1].input.SourceUser.ProviderAttributeValue).toBe('42');
  });
});
