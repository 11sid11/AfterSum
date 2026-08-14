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

  it('preserves the original monthly day after an end-of-month clamp', () => {
    const anchor = '2026-01-31';
    const february = nextRecurringDate(anchor, 'monthly', anchor);
    const march = nextRecurringDate(february, 'monthly', anchor);
    expect(february).toBe('2026-02-28');
    expect(march).toBe('2026-03-31');
  });

  it('preserves a leap-day yearly anchor', () => {
    const anchor = '2028-02-29';
    const next = nextRecurringDate(anchor, 'yearly', anchor);
    expect(next).toBe('2029-02-28');
    expect(nextRecurringDate('2031-02-28', 'yearly', anchor)).toBe('2032-02-29');
  });
});
