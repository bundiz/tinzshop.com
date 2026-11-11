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
const GENERIC_ERROR = 'Sign-in could not be completed.';

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
      throw new Error(GENERIC_ERROR);
    }
    // The filter is built from the email; refuse characters that would break it.
    if (email.includes('"') || email.includes('\\')) {
      console.log('pre-sign-up: rejected, unusable email');
      throw new Error(GENERIC_ERROR);
    }

    const separator = event.userName.indexOf('_');
    const provider = separator === -1 ? '' : event.userName.slice(0, separator).toLowerCase();
    const googleSubject = separator === -1 ? '' : event.userName.slice(separator + 1);
    if (provider !== 'google' || googleSubject === '') {
      console.log('pre-sign-up: rejected, not a Google user');
      throw new Error(GENERIC_ERROR);
    }

    const poolId = event.userPoolId;
    const found = await cognito.send(
      new ListUsersCommand({ UserPoolId: poolId, Filter: `email = "${email}"`, Limit: 10 }),
    );
    // Only normal (native) users count, not an earlier linked Google user.
    const natives = (found.Users ?? []).filter(
      (u) =>
        u.UserStatus !== 'EXTERNAL_PROVIDER' &&
        (attr(u, 'email') ?? '').toLowerCase() === email,
    );
    const verified = natives.find((u) => attr(u, 'email_verified') === 'true');
    const unverified = verified ? undefined : natives[0];

    // Case 3 is limited to a user who never confirmed; anything else unverified
    // is an unexpected state, so refuse rather than delete.
    if (unverified && unverified.UserStatus !== 'UNCONFIRMED') {
      console.log('pre-sign-up: rejected, unexpected unverified user');
      throw new Error(GENERIC_ERROR);
    }

    let username;
    let outcome;
    if (verified) {
      // Case 2: a verified user exists, link Google to it.
      username = verified.Username;
      outcome = 'linked to existing verified user';
    } else {
      if (unverified) {
        // Case 3: never verified; Google just proved ownership, so remove it.
        await cognito.send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: unverified.Username }));
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
      outcome = unverified ? 'replaced unverified user and linked' : 'created user and linked';
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
    console.log(`pre-sign-up: ${outcome}`);
    return event;
  };
}

export const handler = createPreSignUpHandler({ cognito: new CognitoIdentityProviderClient({}) });
