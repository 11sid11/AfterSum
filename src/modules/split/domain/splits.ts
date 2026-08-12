/**
 * Split method calculators.
 *
 * Pure functions that take a minor-unit amount and a list of
 * participants and return the integer minor-unit share for each
 * participant. The output array is aligned with the input
 * `personIds` order. The sum of the output is guaranteed to
 * equal the input amount exactly.
 *
 * The functions are deliberately thin wrappers over
 * `@shared/money/allocate` plus a `assertSumsTo` invariant
 * check so any future drift in the shared allocator is caught
 * immediately.
 *
 * Module independence: this file does not import from
 * Track, Lend, or the Dexie database. It can be safely used
 * inside a service or a test.
 */

import {
  allocateEqual,
  allocateByPercentage,
  allocateByShares,
  assertSumsTo,
  sumMinor,
} from '@shared/money';

/**
 * Equal split. `100 / 3 -> [3334, 3333, 3333]`.
 *
 * Throws if `personIds` is empty.
 */
export function computeEqualShares(
  amountMinor: number,
  personIds: readonly string[],
): number[] {
  if (personIds.length === 0) {
    throw new Error('computeEqualShares: at least one participant is required');
  }
  const out = allocateEqual(amountMinor, personIds.length);
  assertSumsTo(out, amountMinor, 'computeEqualShares');
  return out;
}

/**
 * Exact split. The user has already provided the final amount
 * for each participant. The amounts are validated to sum to
 * the expense total.
 */
export function computeExactShares(
  amountMinor: number,
  personIds: readonly string[],
  exactAmountsByPersonId: Readonly<Record<string, number>>,
): number[] {
  if (personIds.length === 0) {
    throw new Error('computeExactShares: at least one participant is required');
  }
  const values = personIds.map((pid) => {
    const v = exactAmountsByPersonId[pid];
    if (v === undefined || v === null) {
      throw new Error(`computeExactShares: missing exact amount for ${pid}`);
    }
    if (!Number.isFinite(v) || !Number.isInteger(v) || v <= 0) {
      throw new Error(
        `computeExactShares: exact amount for ${pid} must be a positive integer (got ${v})`,
      );
    }
    return v;
  });
  assertSumsTo(values, amountMinor, 'computeExactShares');
  return values;
}

/**
 * Percentage split. The user provides a percentage (0..100)
 * for each participant; the function computes integer
 * minor-unit shares that sum to the expense total.
 */
export function computePercentageShares(
  amountMinor: number,
  personIds: readonly string[],
  percentagesByPersonId: Readonly<Record<string, number>>,
): number[] {
  if (personIds.length === 0) {
    throw new Error('computePercentageShares: at least one participant is required');
  }
  const pcts = personIds.map((pid) => {
    const p = percentagesByPersonId[pid];
    if (p === undefined || p === null) {
      throw new Error(`computePercentageShares: missing percentage for ${pid}`);
    }
    if (!Number.isFinite(p) || p < 0 || p > 100) {
      throw new Error(
        `computePercentageShares: percentage for ${pid} must be in 0..100 (got ${p})`,
      );
    }
    return p;
  });
  // `allocateByPercentage` already throws if percentages don't sum to 100.
  const out = allocateByPercentage(amountMinor, pcts);
  assertSumsTo(out, amountMinor, 'computePercentageShares');
  return out;
}

/**
 * Share-weighted split. The user provides an integer weight
 * for each participant; the function computes integer
 * minor-unit shares that sum to the expense total.
 *
 * The shared allocator already rejects non-positive total
 * shares, but we re-check here so the error message names
 * the split module.
 */
export function computeShareWeightedShares(
  amountMinor: number,
  personIds: readonly string[],
  sharesByPersonId: Readonly<Record<string, number>>,
): number[] {
  if (personIds.length === 0) {
    throw new Error('computeShareWeightedShares: at least one participant is required');
  }
  const shares = personIds.map((pid) => {
    const s = sharesByPersonId[pid];
    if (s === undefined || s === null) {
      throw new Error(`computeShareWeightedShares: missing share weight for ${pid}`);
    }
    if (!Number.isFinite(s) || !Number.isInteger(s) || s <= 0) {
      throw new Error(
        `computeShareWeightedShares: share weight for ${pid} must be a positive integer (got ${s})`,
      );
    }
    return s;
  });
  if (sumMinor(shares) <= 0) {
    throw new Error('computeShareWeightedShares: total shares must be > 0');
  }
  const out = allocateByShares(amountMinor, shares);
  assertSumsTo(out, amountMinor, 'computeShareWeightedShares');
  return out;
}
