import { describe, expect, it } from 'vitest';

import { parseMediaConfig, parseMediaPublicBaseUrl } from './config';

const valid = {
  MEDIA_S3_BUCKET: 'example-media-dev',
  MEDIA_S3_REGION: 'ap-southeast-7',
  MEDIA_PUBLIC_BASE_URL: 'https://example-media-dev.s3.ap-southeast-7.amazonaws.com',
};

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  return 'no error';
}

describe('parseMediaConfig', () => {
  it('parses a valid environment', () => {
    expect(parseMediaConfig(valid)).toEqual({
      bucket: 'example-media-dev',
      region: 'ap-southeast-7',
      publicBaseUrl: 'https://example-media-dev.s3.ap-southeast-7.amazonaws.com',
    });
  });

  it('removes one trailing slash from the base URL, and keeps a path-style address', () => {
    expect(parseMediaConfig({ ...valid, MEDIA_PUBLIC_BASE_URL: `${valid.MEDIA_PUBLIC_BASE_URL}/` }).publicBaseUrl).toBe(
      valid.MEDIA_PUBLIC_BASE_URL,
    );
    const pathStyle = 'https://s3.ap-southeast-7.amazonaws.com/example-media-dev';
    expect(parseMediaConfig({ ...valid, MEDIA_PUBLIC_BASE_URL: `${pathStyle}/` }).publicBaseUrl).toBe(pathStyle);
  });

  it.each(['MEDIA_S3_BUCKET', 'MEDIA_S3_REGION', 'MEDIA_PUBLIC_BASE_URL'] as const)(
    'refuses a missing or empty %s and names it',
    (name) => {
      const missing: Record<string, string | undefined> = { ...valid };
      delete missing[name];
      expect(messageOf(() => parseMediaConfig(missing))).toMatch(new RegExp(`Invalid server configuration.*${name}`));
      expect(messageOf(() => parseMediaConfig({ ...valid, [name]: '' }))).toMatch(new RegExp(name));
    },
  );

  it.each(['Upper-Case', 'ab', 'a'.repeat(64), 'under_score', '-leading', 'trailing-', 'has space'])(
    'refuses the bucket name %s without printing it',
    (bucket) => {
      const message = messageOf(() => parseMediaConfig({ ...valid, MEDIA_S3_BUCKET: bucket }));
      expect(message).toMatch(/MEDIA_S3_BUCKET/);
      expect(message).not.toContain(bucket);
    },
  );

  it.each(['Asia Pacific', 'ap-southeast', 'ap_southeast_7', 'https://s3.ap-southeast-7.amazonaws.com'])(
    'refuses the region %s',
    (region) => {
      expect(messageOf(() => parseMediaConfig({ ...valid, MEDIA_S3_REGION: region }))).toMatch(/MEDIA_S3_REGION/);
    },
  );

  it.each([
    ['http', 'http://example-media-dev.s3.ap-southeast-7.amazonaws.com'],
    ['a quote', 'https://example.com/a"onerror="x'],
    ['a single quote', "https://example.com/a'b"],
    ['an angle bracket', 'https://example.com/<script>'],
    ['a query', 'https://example.com/media?x=1'],
    ['a fragment', 'https://example.com/media#x'],
    ['a user and password', 'https://user:secret@example.com'],
    ['a space', 'https://example.com/a b'],
    ['two trailing slashes', 'https://example.com//'],
    ['no host', 'https:///media'],
    ['not a URL', 'example.com'],
  ])('refuses a base URL with %s, naming the variable and never the value', (_, url) => {
    const message = messageOf(() => parseMediaConfig({ ...valid, MEDIA_PUBLIC_BASE_URL: url }));
    expect(message).toMatch(/MEDIA_PUBLIC_BASE_URL/);
    expect(message).not.toContain(url);
    expect(message).not.toContain('secret');
  });
});

describe('parseMediaPublicBaseUrl', () => {
  it('reads only the base URL, so pages work without the bucket settings', () => {
    expect(parseMediaPublicBaseUrl({ MEDIA_PUBLIC_BASE_URL: 'https://media.example.com/' })).toBe('https://media.example.com');
  });

  it('is null when the base URL is unset or empty', () => {
    expect(parseMediaPublicBaseUrl({})).toBeNull();
    expect(parseMediaPublicBaseUrl({ MEDIA_PUBLIC_BASE_URL: '' })).toBeNull();
  });

  it('refuses a bad base URL rather than letting a page write it', () => {
    expect(() => parseMediaPublicBaseUrl({ MEDIA_PUBLIC_BASE_URL: 'https://example.com/"' })).toThrow(/MEDIA_PUBLIC_BASE_URL/);
  });
});
