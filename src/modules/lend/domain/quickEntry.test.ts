import { describe, expect, it } from 'vitest';
import type { LendEntry } from '@db/schema';
import {
  lendEntryCashDirection,
  quickLendEntryLimitMinor,
  resolveQuickLendEntryType,
  runningBalanceByEntryId,
  wouldQuickLendEntryCrossBalance,
} from './quickEntry';

function entry(
  id: string,
  type: LendEntry['type'],
  amountMinor: number,
  date: string,
  createdAt: string,
): LendEntry {
  return {
    id,
    ledgerId: 'ledger-1',
    type,
    amountMinor,
    date,
    createdAt,
    updatedAt: createdAt,
    revision: 1,
  };
}

describe('quick Lend entry mapping', () => {
  it('maps gave/got against positive, negative, and settled balances', () => {
    expect(resolveQuickLendEntryType('gave', 5_000)).toBe('lent');
    expect(resolveQuickLendEntryType('got', 5_000)).toBe('repayment_received');

    expect(resolveQuickLendEntryType('gave', -5_000)).toBe('repayment_given');
    expect(resolveQuickLendEntryType('got', -5_000)).toBe('borrowed');

    expect(resolveQuickLendEntryType('gave', 0)).toBe('lent');
    expect(resolveQuickLendEntryType('got', 0)).toBe('borrowed');
  });

  it('only limits actions that are repayments of the current balance', () => {
    expect(quickLendEntryLimitMinor('got', 5_000)).toBe(5_000);
    expect(quickLendEntryLimitMinor('gave', -5_000)).toBe(5_000);
    expect(quickLendEntryLimitMinor('gave', 5_000)).toBeUndefined();
    expect(quickLendEntryLimitMinor('got', -5_000)).toBeUndefined();
    expect(quickLendEntryLimitMinor('gave', 0)).toBeUndefined();
    expect(quickLendEntryLimitMinor('got', 0)).toBeUndefined();
  });

  it('prevents a single quick entry from silently crossing settlement', () => {
    expect(wouldQuickLendEntryCrossBalance('got', 5_000, 5_001)).toBe(true);
    expect(wouldQuickLendEntryCrossBalance('got', 5_000, 5_000)).toBe(false);
    expect(wouldQuickLendEntryCrossBalance('gave', -5_000, 5_001)).toBe(true);
    expect(wouldQuickLendEntryCrossBalance('gave', -5_000, 5_000)).toBe(false);
    expect(wouldQuickLendEntryCrossBalance('gave', 5_000, 50_000)).toBe(false);
  });

  it('projects existing canonical events into gave/got cash directions', () => {
    expect(lendEntryCashDirection({ type: 'lent' })).toBe('gave');
    expect(lendEntryCashDirection({ type: 'repayment_given' })).toBe('gave');
    expect(lendEntryCashDirection({ type: 'borrowed' })).toBe('got');
    expect(lendEntryCashDirection({ type: 'repayment_received' })).toBe('got');
    expect(lendEntryCashDirection({ type: 'adjustment' })).toBe('adjustment');
  });

  it('derives the historical running balance without storing it', () => {
    const entries = [
      entry('c', 'repayment_received', 300, '2026-08-03', '2026-08-03T10:00:00.000Z'),
      entry('a', 'lent', 1_000, '2026-08-01', '2026-08-01T10:00:00.000Z'),
      entry('b', 'lent', 500, '2026-08-02', '2026-08-02T10:00:00.000Z'),
    ];

    expect(runningBalanceByEntryId(entries)).toEqual({
      a: 1_000,
      b: 1_500,
      c: 1_200,
    });
  });
});
