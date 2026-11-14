import { describe, expect, it } from 'vitest';
import { PLATFORM_TONE, platformTone } from './platform-tone';

describe('platformTone', () => {
  it('maps the three platform slugs', () => {
    expect(platformTone('playstation-5')).toBe('ps');
    expect(platformTone('nintendo-switch')).toBe('ns');
    expect(platformTone('it-gadgets')).toBe('it');
  });

  it('maps null and an unknown slug to other', () => {
    expect(platformTone(null)).toBe('other');
    expect(platformTone('xbox')).toBe('other');
    // Object prototype keys are not platforms.
    expect(platformTone('constructor')).toBe('other');
  });

  it('exposes the table', () => {
    expect(PLATFORM_TONE).toEqual({ 'playstation-5': 'ps', 'nintendo-switch': 'ns', 'it-gadgets': 'it' });
  });
});
