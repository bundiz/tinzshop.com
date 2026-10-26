const SATANG_PER_BAHT = 100;
const DECIMAL_TOLERANCE = 1e-6;

/**
 * Converts a decimal baht amount to whole satang. This is the only place in the
 * codebase where money is rounded (D-010). Rejects negative, non-finite and
 * more-than-two-decimal amounts rather than silently rounding them.
 */
export function bahtToSatang(baht: number): bigint {
  if (!Number.isFinite(baht) || baht < 0) {
    throw new RangeError("Baht amount must be a finite, non-negative number");
  }
  const scaled = baht * SATANG_PER_BAHT;
  const rounded = Math.round(scaled);
  if (
    Math.abs(scaled - rounded) > DECIMAL_TOLERANCE ||
    !Number.isSafeInteger(rounded)
  ) {
    throw new RangeError("Baht amount must have at most two decimal places");
  }
  return BigInt(rounded);
}
