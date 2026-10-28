import { describe, expect, it } from 'vitest';
import { parseServerConfig } from '@/server/config';

const VALID = {
  SHOPEE_PARTNER_ID: '1236675',
  SHOPEE_PARTNER_KEY: 'k'.repeat(64),
  SHOPEE_SHOP_ID: '227679200',
  JOB_SECRET: 'j'.repeat(32),
  CHANNEL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

describe('parseServerConfig', () => {
  it('parses a valid environment', () => {
    const config = parseServerConfig(VALID);
    expect(config.shopee.partnerId).toBe(1236675);
    expect(config.shopee.shopId).toBe(227679200n);
    expect(config.channelTokenEncryptionKey.length).toBe(32);
  });

  it('rejects a missing shop id, naming the variable', () => {
    const { SHOPEE_SHOP_ID: _omitted, ...rest } = VALID;
    expect(() => parseServerConfig(rest)).toThrow('SHOPEE_SHOP_ID');
  });

  it.each(['0', 'abc', '9007199254740993', '', '12a'])('rejects shop id %j', (value) => {
    expect(() => parseServerConfig({ ...VALID, SHOPEE_SHOP_ID: value })).toThrow('SHOPEE_SHOP_ID');
  });

  it('defaults the Shopee host to the sandbox', () => {
    expect(parseServerConfig(VALID).shopee.apiBaseUrl).toBe(
      'https://openplatform.sandbox.test-stable.shopee.sg',
    );
  });

  it('rejects a missing partner key without echoing secrets', () => {
    const { SHOPEE_PARTNER_KEY: _omitted, ...rest } = VALID;
    let message = '';
    try {
      parseServerConfig(rest);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('SHOPEE_PARTNER_KEY');
    expect(message).not.toContain('j'.repeat(32));
  });

  it('rejects an encryption key that is not 32 bytes', () => {
    expect(() =>
      parseServerConfig({
        ...VALID,
        CHANNEL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(31).toString('base64'),
      }),
    ).toThrow('CHANNEL_TOKEN_ENCRYPTION_KEY');
  });

  it('rejects a short job secret', () => {
    expect(() => parseServerConfig({ ...VALID, JOB_SECRET: 'short' })).toThrow('JOB_SECRET');
  });

  it('rejects a non-https Shopee host', () => {
    expect(() =>
      parseServerConfig({ ...VALID, SHOPEE_API_BASE_URL: 'http://example.com' }),
    ).toThrow();
  });
});
