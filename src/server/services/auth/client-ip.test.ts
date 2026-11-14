import { describe, expect, it } from 'vitest';

import { resolveClientIp } from './client-ip';

describe('resolveClientIp', () => {
  it('takes the right-most X-Forwarded-For entry', () => {
    const headers = new Headers({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1 , 203.0.113.9' });
    expect(resolveClientIp(headers, 'x-forwarded-for')).toBe('203.0.113.9');
  });

  it('skips empty entries', () => {
    expect(resolveClientIp(new Headers({ 'x-forwarded-for': '1.1.1.1, ,' }), 'x-forwarded-for')).toBe('1.1.1.1');
  });

  it('uses cf-connecting-ip when configured and ignores X-Forwarded-For', () => {
    const headers = new Headers({ 'x-forwarded-for': '6.6.6.6', 'cf-connecting-ip': '198.51.100.7' });
    expect(resolveClientIp(headers, 'cf-connecting-ip')).toBe('198.51.100.7');
  });

  it('returns null when the header is absent', () => {
    expect(resolveClientIp(new Headers(), 'x-forwarded-for')).toBeNull();
    expect(resolveClientIp(new Headers({ 'x-forwarded-for': '1.1.1.1' }), 'cf-connecting-ip')).toBeNull();
  });
});
