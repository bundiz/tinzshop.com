import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { parseAuthConfig } from './config';

const key = randomBytes(32).toString('base64');
const valid = {
  COGNITO_REGION: 'ap-southeast-1',
  COGNITO_USER_POOL_ID: 'ap-southeast-1_AbCdEf123',
  COGNITO_CLIENT_ID: 'client-id-123',
  COGNITO_CLIENT_SECRET: 'client-secret-value',
  COGNITO_DOMAIN: 'example.auth.ap-southeast-1.amazoncognito.com',
  SESSION_TOKEN_ENCRYPTION_KEY: key,
};

describe('parseAuthConfig', () => {
  it('parses a valid environment and defaults the proxy header', () => {
    const config = parseAuthConfig(valid);
    expect(config.trustedProxyHeader).toBe('x-forwarded-for');
    expect(config.sessionTokenEncryptionKey.length).toBe(32);
    expect(config.domain).toBe(valid.COGNITO_DOMAIN);
  });

  it('accepts cf-connecting-ip and treats an empty header as unset', () => {
    expect(parseAuthConfig({ ...valid, TRUSTED_PROXY_HEADER: 'cf-connecting-ip' }).trustedProxyHeader).toBe('cf-connecting-ip');
    expect(parseAuthConfig({ ...valid, TRUSTED_PROXY_HEADER: '' }).trustedProxyHeader).toBe('x-forwarded-for');
  });

  it('rejects a short key and an empty client secret without printing any value', () => {
    const shortKey = Buffer.from('too-short').toString('base64');
    for (const env of [
      { ...valid, SESSION_TOKEN_ENCRYPTION_KEY: shortKey },
      { ...valid, COGNITO_CLIENT_SECRET: '' },
    ]) {
      let message = '';
      try {
        parseAuthConfig(env);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/Invalid server configuration/);
      expect(message).not.toContain(shortKey);
      expect(message).not.toContain(valid.COGNITO_CLIENT_ID);
      expect(message).not.toContain(valid.COGNITO_USER_POOL_ID);
    }
  });

  it('names the failing variable', () => {
    expect(() => parseAuthConfig({ ...valid, COGNITO_CLIENT_SECRET: '' })).toThrow(/COGNITO_CLIENT_SECRET/);
  });
});
