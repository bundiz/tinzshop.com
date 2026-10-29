import { timingSafeEqual } from 'node:crypto';

/**
 * True only when the `Authorization` header is exactly `Bearer <secret>`. The comparison is
 * constant time; a missing header, another scheme or another length is simply a refusal.
 */
export function isJobAuthorized(header: string | null, jobSecret: string): boolean {
  if (header === null) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${jobSecret}`);
  // timingSafeEqual throws on unequal lengths; a length mismatch is simply a refusal.
  return given.length === expected.length && timingSafeEqual(given, expected);
}
