import { describe, expect, it } from 'vitest';

import { secretHash } from './secret-hash';

describe('secretHash', () => {
  it('matches a known vector: base64(HMAC-SHA256(secret, username + clientId))', () => {
    expect(secretHash({ clientSecret: 'secret-for-test', clientId: 'client-id-123', username: 'user@example.com' })).toBe(
      '42r3gHyENJizTDI3hQxLxS6ym9keoFxzDouYc/s9Qsw=',
    );
  });
});
