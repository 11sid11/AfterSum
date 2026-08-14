import { describe, expect, it } from 'vitest';
import {
  isTripDefaultSplitValid,
  itemizedAllocation,
  nextRecurringDate,
  resolveTripDefaultSplit,
} from './entry';

describe('Split entry defaults', () => {
  it('reuses a valid saved percentage split', () => {
    const saved = {
      payerPersonId: 'me',
      participantIds: ['me', 'rahul'],
      splitMethod: 'percentage' as const,
      allocation: { percentagesByPersonId: { me: 60, rahul: 40 } },
    };

    expect(isTripDefaultSplitValid(saved, ['me', 'rahul', 'aman'])).toBe(true);
    expect(
      resolveTripDefaultSplit({
        saved,
        activePersonIds: ['me', 'rahul', 'aman'],
        preferredPayerId: 'me',
      }),
    ).toEqual({
      payerPersonId: 'me',
      participantIds: ['me', 'rahul'],
      splitMethod: 'percentage',
      allocation: { percentagesByPersonId: { me: 60, rahul: 40 } },
    });
  });

  it('falls back safely when a saved participant is no longer active', () => {
    const saved = {
      payerPersonId: 'me',
      participantIds: ['me', 'rahul'],
      splitMethod: 'equal' as const,
    };

    expect(isTripDefaultSplitValid(saved, ['me', 'aman'])).toBe(false);
    expect(
      resolveTripDefaultSplit({
        saved,
        activePersonIds: ['me', 'aman'],
        preferredPayerId: 'me',
      }),
    ).toEqual({
      payerPersonId: 'me',
      participantIds: ['me', 'aman'],
      splitMethod: 'equal',
      allocation: {},
    });
  });
});

describe('itemizedAllocation', () => {
  it('collapses item allocations into exact per-person totals without losing minor units', () => {
    const result = itemizedAllocation([
      { id: 'pizza', title: 'Pizza', amountMinor: 1001, participantIds: ['me', 'rahul'] },
      { id: 'drink', title: 'Drink', amountMinor: 500, participantIds: ['rahul'] },
    ]);

    expect(result.totalAmountMinor).toBe(1501);
    expect(result.participantIds).toEqual(['me', 'rahul']);
    expect(result.amountsByPersonId).toEqual({ me: 501, rahul: 1000 });
    expect(Object.values(result.amountsByPersonId).reduce((sum, value) => sum + value, 0)).toBe(1501);
  });
});

describe('nextRecurringDate', () => {
  it('advances weekly dates', () => {
    expect(nextRecurringDate('2026-08-14', 'weekly')).toBe('2026-08-21');
  });

  it('clamps monthly end-of-month dates instead of overflowing into another month', () => {
    expect(nextRecurringDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextRecurringDate('2028-01-31', 'monthly')).toBe('2028-02-29');
  });

  it('clamps leap day for yearly recurrence', () => {
    expect(nextRecurringDate('2028-02-29', 'yearly')).toBe('2029-02-28');
  });
});
