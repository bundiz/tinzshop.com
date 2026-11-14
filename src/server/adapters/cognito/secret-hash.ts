import { createHmac } from 'node:crypto';

/** Cognito's SECRET_HASH: base64(HMAC-SHA256(clientSecret, username + clientId)). */
export function secretHash(input: { clientSecret: string; clientId: string; username: string }): string {
  return createHmac('sha256', input.clientSecret).update(input.username + input.clientId).digest('base64');
}
