import { currencyDecimals } from './types';
import type { CurrencyCode } from './types';

/**
 * Money allocation strategies.
 *
 * All three functions return an array of integer minor units that
 * always sum to the original input. Remainders are distributed
 * to the first N participants by adding 1 minor unit so the
 * invariant `sum(out) === amountMinor` always holds.
 */

/**
 * Distribute `amountMinor` equally among `n` parts.
 *
 * Example: allocateEqual(10000, 3) -> [3334, 3333, 3333]
 */
export function allocateEqual(amountMinor: number, n: number): number[] {
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error(`allocateEqual: n must be a positive integer, got ${n}`);
  }
  if (amountMinor === 0) return new Array(n).fill(0);
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const base = Math.floor(abs / n);
  const remainder = abs - base * n;
  const out = new Array<number>(n).fill(base);
  // Distribute the remainder 1-minor-unit at a time to the first
  // `remainder` slots. Keeps things deterministic and easy to test.
  for (let i = 0; i < remainder; i++) out[i] = (out[i] ?? 0) + 1;
  return negative ? out.map((v) => -v) : out;
}

/**
 * Distribute by percentage. Percentages are 0..100 (not 0..1).
 * Throws if `percentages` don't sum to 100 within rounding tolerance.
 */
export function allocateByPercentage(
  amountMinor: number,
  percentages: number[],
): number[] {
  if (percentages.length === 0) return [];
  const total = percentages.reduce((a, b) => a + b, 0);
  if (Math.abs(total - 100) > 0.0001) {
    throw new Error(`allocateByPercentage: percentages must sum to 100, got ${total}`);
  }
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  // Multiply through then distribute remainder. We compute the
  // floor of each share and then push the leftover minor units
  // onto the largest shares first (matches how the rest of the
  // app does it for share-based splits).
  const raw = percentages.map((p) => (p / 100) * abs);
  const floored = raw.map((v) => Math.floor(v));
  const allocated = floored.reduce((a, b) => a + b, 0);
  let remainder = abs - allocated;
  // Indices sorted by raw share descending.
  const order = raw
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.i);
  const out = [...floored];
  for (let k = 0; k < order.length && remainder > 0; k++) {
    const idx = order[k]!;
    out[idx] = (out[idx] ?? 0) + 1;
    remainder--;
  }
  return negative ? out.map((v) => -v) : out;
}

/**
 * Distribute by shares (integer weights). Total is proportional.
 *
 * Example: amountMinor=1000, shares=[1,1,1,2] -> [250,250,250,500]
 */
export function allocateByShares(amountMinor: number, shares: number[]): number[] {
  if (shares.length === 0) return [];
  const total = shares.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    throw new Error('allocateByShares: shares must sum to a positive number');
  }
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const out = shares.map((s) => Math.floor((s / total) * abs));
  let remainder = abs - out.reduce((a, b) => a + b, 0);
  // Distribute leftover 1 unit at a time to the highest-share slots
  // so the result remains stable across runs.
  const order = shares
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.i);
  for (let k = 0; k < order.length && remainder > 0; k++) {
    const idx = order[k]!;
    out[idx] = (out[idx] ?? 0) + 1;
    remainder--;
  }
  return negative ? out.map((v) => -v) : out;
}

/**
 * Sum minor units across an array, optionally filtering or
 * grouping. Used heavily in balance calculations.
 */
export function sumMinor(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Assert that a list of minor-unit values sums exactly to a target.
 * Used by domain rules to guarantee allocation never drifts.
 */
export function assertSumsTo(values: number[], target: number, ctx?: string): void {
  const sum = sumMinor(values);
  if (sum !== target) {
    throw new Error(
      `Allocation invariant broken${ctx ? ` (${ctx})` : ''}: sum=${sum}, target=${target}`,
    );
  }
}

/**
 * Round a minor-unit amount to a different currency's decimal
 * places. Used when projecting from a sub-unit-currency ledger
 * to a summary display. Rounds half-up.
 */
export function roundToCurrency(
  amountMinor: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
): number {
  const fromDecimals = currencyDecimals(fromCurrency);
  const toDecimals = currencyDecimals(toCurrency);
  if (fromDecimals === toDecimals) return amountMinor;
  const factor = 10 ** (toDecimals - fromDecimals);
  if (factor > 0) {
    return Math.round(amountMinor * factor);
  }
  return Math.round(amountMinor / Math.abs(factor));
}
