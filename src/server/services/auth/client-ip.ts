export type TrustedProxyHeader = 'x-forwarded-for' | 'cf-connecting-ip';

/**
 * The client address for rate limiting. `x-forwarded-for` uses the right-most entry, the one the
 * nearest proxy added; the left-most is client-controlled and never trusted.
 */
export function resolveClientIp(headers: Headers, trusted: TrustedProxyHeader): string | null {
  if (trusted === 'cf-connecting-ip') {
    const value = headers.get('cf-connecting-ip')?.trim();
    return value ? value : null;
  }
  const entries = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  return entries.length > 0 ? (entries[entries.length - 1] as string) : null;
}
