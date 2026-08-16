import type { LendEntry, LendEntryType } from '@db/schema';
import { entryToSignedAmount } from './signs';

export type LendQuickDirection = 'gave' | 'got';
export type LendQuickEntryType = Exclude<LendEntryType, 'adjustment'>;

/**
 * Translate the two user-facing cash directions into the existing canonical
 * Lend event types. The current balance supplies the repayment context.
 *
 * positive balance = they owe me
 * negative balance = I owe them
 */
export function resolveQuickLendEntryType(
  direction: LendQuickDirection,
  currentBalanceMinor: number,
): LendQuickEntryType {
  if (direction === 'gave') {
    return currentBalanceMinor < 0 ? 'repayment_given' : 'lent';
  }
  return currentBalanceMinor > 0 ? 'repayment_received' : 'borrowed';
}

/**
 * Return the maximum amount that can be entered without silently crossing a
 * settled balance. Undefined means this direction creates/increases debt and
 * therefore has no repayment ceiling.
 */
export function quickLendEntryLimitMinor(
  direction: LendQuickDirection,
  currentBalanceMinor: number,
): number | undefined {
  if (direction === 'got' && currentBalanceMinor > 0) return currentBalanceMinor;
  if (direction === 'gave' && currentBalanceMinor < 0) return Math.abs(currentBalanceMinor);
  return undefined;
}

export function wouldQuickLendEntryCrossBalance(
  direction: LendQuickDirection,
  currentBalanceMinor: number,
  amountMinor: number,
): boolean {
  const limit = quickLendEntryLimitMinor(direction, currentBalanceMinor);
  return limit !== undefined && amountMinor > limit;
}

/** Cash direction shown in the simplified ledger UI for an existing event. */
export function lendEntryCashDirection(
  entry: Pick<LendEntry, 'type'>,
): LendQuickDirection | 'adjustment' {
  switch (entry.type) {
    case 'lent':
    case 'repayment_given':
      return 'gave';
    case 'borrowed':
    case 'repayment_received':
      return 'got';
    case 'adjustment':
      return 'adjustment';
  }
}

/**
 * Historical balance immediately after each active entry. The result can be
 * consumed while rendering the normal newest-first list without persisting a
 * second balance field.
 */
export function runningBalanceByEntryId(
  entries: ReadonlyArray<LendEntry>,
): Readonly<Record<string, number>> {
  const chronological = entries
    .filter((entry) => !entry.deletedAt)
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

  let balanceMinor = 0;
  const balances: Record<string, number> = {};
  for (const entry of chronological) {
    balanceMinor += entryToSignedAmount(entry);
    balances[entry.id] = balanceMinor;
  }
  return balances;
}
