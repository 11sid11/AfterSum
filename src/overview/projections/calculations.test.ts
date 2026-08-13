import { describe, expect, it } from 'vitest';
import { calculateSplitPersonalShareForMonth } from './calculations';
import type { SplitExpense, SplitGroup, SplitShare } from '@db/schema';

const NOW = '2026-08-13T00:00:00.000Z';

function group(id: string, deleted = false): SplitGroup {
  return {
    id,
    name: id,
    currency: 'INR',
    archived: false,
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
    ...(deleted ? { deletedAt: NOW } : {}),
  };
}

function expense(id: string, groupId: string, date: string, currency = 'INR', deleted = false): SplitExpense {
  return {
    id,
    groupId,
    title: id,
    amountMinor: 3000,
    currency,
    date,
    splitMethod: 'equal',
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
    ...(deleted ? { deletedAt: NOW } : {}),
  };
}

function share(id: string, expenseId: string, personId: string, amountMinor: number, deleted = false): SplitShare {
  return {
    id,
    expenseId,
    personId,
    amountMinor,
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
    ...(deleted ? { deletedAt: NOW } : {}),
  };
}

describe('calculateSplitPersonalShareForMonth', () => {
  it('counts only active self shares in the requested month and currency', () => {
    const groups = [group('active'), group('deleted', true)];
    const expenses = [
      expense('included', 'active', '2026-08-10'),
      expense('other-month', 'active', '2026-07-31'),
      expense('other-currency', 'active', '2026-08-11', 'USD'),
      expense('deleted-expense', 'active', '2026-08-12', 'INR', true),
      expense('deleted-group-expense', 'deleted', '2026-08-13'),
    ];
    const shares = [
      share('included-self', 'included', 'self', 1200),
      share('included-other', 'included', 'rahul', 1800),
      share('other-month', 'other-month', 'self', 500),
      share('other-currency', 'other-currency', 'self', 700),
      share('deleted-expense', 'deleted-expense', 'self', 900),
      share('deleted-group', 'deleted-group-expense', 'self', 1100),
      share('deleted-share', 'included', 'self', 300, true),
    ];

    expect(
      calculateSplitPersonalShareForMonth({
        month: '2026-08',
        currency: 'INR',
        selfPersonId: 'self',
        groups,
        expenses,
        shares,
      }),
    ).toBe(1200);
  });
});
