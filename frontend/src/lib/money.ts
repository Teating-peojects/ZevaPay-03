/**
 * Money helpers shared by the merchant screens.
 *
 * Amounts are always in BDT and always whole Taka — the API stores them as
 * integers, and the product never shows paisa.
 */

/** Parses a user-entered amount, returning `null` when it is not usable. */
export function parseAmount(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (trimmed.length === 0) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.round(parsed);
}

/**
 * Builds the lower and upper bounds for an amount range.
 *
 * An empty bound means "no limit on that side", which is `undefined` in the
 * query the API receives.
 */
export function amountBounds(
  min: string,
  max: string,
): { min?: number; max?: number } {
  const lower = parseAmount(min);
  const upper = parseAmount(max);

  return {
    min: lower === null ? undefined : lower,
    max: upper === null ? undefined : upper,
  };
}
