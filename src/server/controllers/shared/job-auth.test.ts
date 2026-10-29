import { describe, expect, it } from 'vitest';

import { isJobAuthorized } from './job-auth';

const SECRET = 'test-job-secret-0123456789abcdef-xyz';

describe('isJobAuthorized', () => {
  it('refuses a missing header', () => {
    expect(isJobAuthorized(null, SECRET)).toBe(false);
  });

  it('refuses another scheme or no scheme', () => {
    expect(isJobAuthorized(`Basic ${SECRET}`, SECRET)).toBe(false);
    expect(isJobAuthorized(SECRET, SECRET)).toBe(false);
    expect(isJobAuthorized(`bearer ${SECRET}`, SECRET)).toBe(false);
  });

  it('refuses a wrong secret of the same length', () => {
    expect(isJobAuthorized(`Bearer ${'x'.repeat(SECRET.length)}`, SECRET)).toBe(false);
  });

  it('refuses a wrong secret of a different length', () => {
    expect(isJobAuthorized(`Bearer ${SECRET}extra`, SECRET)).toBe(false);
    expect(isJobAuthorized(`Bearer ${SECRET.slice(1)}`, SECRET)).toBe(false);
    expect(isJobAuthorized('', SECRET)).toBe(false);
  });

  it('accepts the right secret', () => {
    expect(isJobAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });
});
