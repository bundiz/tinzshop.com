const LOCALE_FIRST_SEGMENT = /^\/(th|en)(?:[/?#]|$)/i;
/** A longer path is not a page link worth carrying through a sign-in. */
export const RETURN_TO_MAX_LENGTH = 512;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * A path on this site to return to after sign-in, or "/". Must start with "/" but not "//", hold
 * no backslash or control character, and carry no locale prefix in any letter case (the locale is added on redirect), and be at most 512 characters.
 */
export function safeReturnTo(value: string | null): string {
  if (value === null || value === '' || value.length > RETURN_TO_MAX_LENGTH) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.includes('\\') || CONTROL_CHARACTERS.test(value)) return '/';
  if (LOCALE_FIRST_SEGMENT.test(value)) return '/';
  return value;
}
