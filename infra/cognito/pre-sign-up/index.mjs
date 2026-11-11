// Cognito pre sign-up trigger: makes every Google login link to one normal
// Cognito user per email (plan 014, spec section 6.3, D-168).
// Plain ESM JavaScript so the Lambda needs no build step.
import { randomBytes } from 'node:crypto';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminLinkProviderForUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

/**
 * @typedef {{ send(command: object): Promise<any> }} CognitoLike
 * @typedef {{
 *   triggerSource: string,
 *   userPoolId: string,
 *   userName: string,
 *   request: { userAttributes: Record<string, string | undefined> },
 *   response?: object,
 * }} PreSignUpEvent
 */

// Fixed suffix: one uppercase, one lowercase, one number, one special
// character, so the password meets the pool policy (D-177).
const PASSWORD_SUFFIX = 'aA1!';

/** An unusable password: nobody ever sees it, and it is never logged. */
function randomPassword() {
  return randomBytes(32).toString('base64url') + PASSWORD_SUFFIX;
}

/** @param {object} user @param {string} name */
function attr(user, name) {
  const found = (user.Attributes ?? []).find((a) => a.Name === name);
  return found?.Value;
}

/** @param {{ cognito: CognitoLike }} deps */
export function createPreSignUpHandler({ cognito }) {
  /** @param {PreSignUpEvent} event */
  return async function handler(event) {
    if (event.triggerSource !== 'PreSignUp_ExternalProvider') {
      return event;
    }

    const attrs = event.request.userAttributes;
    const email = (attrs.email ?? '').trim().toLowerCase();

    // Case 1: Google does not vouch for the email (absent counts as not verified).
    if (attrs.email_verified !== 'true' || email === '') {
      console.log('pre-sign-up: rejected, email not verified');
      throw new Error('Sign-in could not be completed.');
    }
    // The filter is built from the email; refuse characters that would break it.
    if (email.includes('"') || email.includes('\\')) {
      console.log('pre-sign-up: rejected, unusable email');
      throw new Error('Sign-in could not be completed.');
    }

    const separator = event.userName.indexOf('_');
    const googleSubject = separator === -1 ? '' : event.userName.slice(separator + 1);
    if (googleSubject === '') {
      console.log('pre-sign-up: rejected, no provider subject');
      throw new Error('Sign-in could not be completed.');
    }

    const poolId = event.userPoolId;
    const found = await cognito.send(
      new ListUsersCommand({ UserPoolId: poolId, Filter: `email = "${email}"`, Limit: 10 }),
    );
    // Only the normal (native) user counts, not an earlier linked Google user.
    const native = (found.Users ?? []).find(
      (u) =>
        u.UserStatus !== 'EXTERNAL_PROVIDER' &&
        (attr(u, 'email') ?? '').toLowerCase() === email,
    );

    let username;
    if (native && attr(native, 'email_verified') === 'true') {
      // Case 2: a verified user exists, link Google to it.
      console.log('pre-sign-up: linked to existing verified user');
      username = native.Username;
    } else {
      if (native) {
        // Case 3: never verified; Google just proved ownership, so remove it.
        await cognito.send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: native.Username }));
      }
      // Case 4: create a normal, confirmed user with no invite email.
      const userAttributes = [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ];
      if (attrs.given_name) userAttributes.push({ Name: 'given_name', Value: attrs.given_name });
      if (attrs.family_name) userAttributes.push({ Name: 'family_name', Value: attrs.family_name });
      const created = await cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: poolId,
          Username: email,
          UserAttributes: userAttributes,
          MessageAction: 'SUPPRESS',
        }),
      );
      username = created.User.Username;
      await cognito.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: poolId,
          Username: username,
          Password: randomPassword(),
          Permanent: true,
        }),
      );
      console.log(native ? 'pre-sign-up: replaced unverified user' : 'pre-sign-up: created user');
    }

    await cognito.send(
      new AdminLinkProviderForUserCommand({
        UserPoolId: poolId,
        DestinationUser: { ProviderName: 'Cognito', ProviderAttributeValue: username },
        SourceUser: {
          ProviderName: 'Google',
          ProviderAttributeName: 'Cognito_Subject',
          ProviderAttributeValue: googleSubject,
        },
      }),
    );
    return event;
  };
}

export const handler = createPreSignUpHandler({ cognito: new CognitoIdentityProviderClient({}) });
