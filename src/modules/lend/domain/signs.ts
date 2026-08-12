/**
 * Lend sign convention.
 *
 * The whole module collapses every entry type to a single
 * signed integer in MINOR UNITS:
 *
 *   positive  = they owe me
 *   negative  = I owe them
 *
 * `adjustment` is a special case: the user enters the signed
 * amount directly (the value is used as-is). All other
 * types use the magnitude of the user's input plus the
 * canonical sign for that type.
 *
 * This is the single source of truth for the Lend sign
 * table. UI, repositories, and tests must consult it
 * rather than hardcoding signs.
 */

import type { LendEntry, LendEntryType } from '@db/schema';

/**
 * The canonical sign multiplier for each non-adjustment
 * entry type. The product of this with the user-entered
 * `amountMinor` produces the signed entry amount.
 */
export const ENTRY_TYPE_SIGN: Readonly<Record<Exclude<LendEntryType, 'adjustment'>, 1 | -1>> = {
  lent: 1,
  borrowed: -1,
  repayment_received: -1,
  repayment_given: 1,
} as const;

/** A human-friendly label for each entry type. */
export const ENTRY_TYPE_LABEL: Readonly<Record<LendEntryType, string>> = {
  lent: 'You lent',
  borrowed: 'You borrowed',
  repayment_received: 'You received a repayment',
  repayment_given: 'You gave a repayment',
  adjustment: 'Adjustment',
};

/** Short label for compact UI (e.g. lists). */
export const ENTRY_TYPE_SHORT_LABEL: Readonly<Record<LendEntryType, string>> = {
  lent: 'Lent',
  borrowed: 'Borrowed',
  repayment_received: 'Repaid you',
  repayment_given: 'You repaid',
  adjustment: 'Adjustment',
};

/**
 * Convert a Lend entry to its signed amount in minor units.
 *
 * For the four non-adjustment types, the signed amount is
 * `amountMinor * ENTRY_TYPE_SIGN[type]`. For `adjustment`,
 * the stored `amountMinor` is the signed amount itself
 * (the user entered it pre-signed).
 *
 * Soft-deleted entries are still signed so that a delete +
 * undo cycle can be reasoned about consistently; the caller
 * is responsible for filtering deleted rows.
 */
export function entryToSignedAmount(entry: Pick<LendEntry, 'type' | 'amountMinor'>): number {
  if (entry.type === 'adjustment') return entry.amountMinor;
  return entry.amountMinor * ENTRY_TYPE_SIGN[entry.type];
}

/**
 * Convert a user-entered magnitude (always positive in the
 * UI) and an entry type into the stored minor-unit value.
 *
 * For non-adjustment types this is the magnitude as-is.
 * For `adjustment`, the user can enter a negative value, so
 * the stored value IS the signed amount.
 */
export function magnitudeToStoredAmount(type: LendEntryType, magnitudeMinor: number): number {
  if (type === 'adjustment') return magnitudeMinor;
  return Math.abs(magnitudeMinor);
}
