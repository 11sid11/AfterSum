/**
 * Aggregations — pure-function tests.
 */

import { describe, it, expect } from 'vitest';
import {
  monthlyTotal,
  categoryTotals,
  paymentMethodTotals,
  dailyTotals,
  filterTransactions,
  budgetProgress,
  recentTransactions,
} from './aggregations';
import type { TrackTransaction } from '@db/schema';

const baseT = (
  partial: Partial<TrackTransaction> & Pick<TrackTransaction, 'id' | 'type' | 'title' | 'amountMinor' | 'currency' | 'date'>,
): TrackTransaction => ({
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  revision: 1,
  ...partial,
});

const TX = (id: string, date: string, amountMinor: number, type: 'expense' | 'income' = 'expense'): TrackTransaction =>
  baseT({ id, type, title: id, amountMinor, currency: 'INR', date });

describe('monthlyTotal', () => {
  it('returns 0 for an empty list', () => {
    expect(monthlyTotal([], '2026-08')).toBe(0);
  });

  it('sums expenses for the given month only', () => {
    const list = [
      TX('a', '2026-08-01', 1000),
      TX('b', '2026-08-15', 2000),
      TX('c', '2026-07-31', 9999), // previous month
      TX('d', '2026-09-01', 9999), // next month
    ];
    expect(monthlyTotal(list, '2026-08', 'expense')).toBe(3000);
  });

  it('excludes soft-deleted transactions', () => {
    const list = [TX('a', '2026-08-01', 1000), { ...TX('b', '2026-08-02', 5000), deletedAt: '2026-08-03' }];
    expect(monthlyTotal(list, '2026-08', 'expense')).toBe(1000);
  });

  it('sums income when type=income', () => {
    const list = [TX('a', '2026-08-01', 1000, 'expense'), TX('b', '2026-08-02', 5000, 'income')];
    expect(monthlyTotal(list, '2026-08', 'income')).toBe(5000);
  });

  it('returns combined total when type is omitted', () => {
    const list = [TX('a', '2026-08-01', 1000, 'expense'), TX('b', '2026-08-02', 5000, 'income')];
    expect(monthlyTotal(list, '2026-08')).toBe(6000);
  });
});

describe('categoryTotals', () => {
  it('groups by categoryId and sorts desc', () => {
    const list: TrackTransaction[] = [
      { ...TX('a', '2026-08-01', 1000), categoryId: 'food' },
      { ...TX('b', '2026-08-02', 3000), categoryId: 'travel' },
      { ...TX('c', '2026-08-03', 1000), categoryId: 'food' },
      { ...TX('d', '2026-08-04', 9999), categoryId: 'travel' },
    ];
    const out = categoryTotals(list, '2026-08');
    expect(out[0]?.categoryId).toBe('travel');
    expect(out[0]?.totalMinor).toBe(12999);
    expect(out[0]?.count).toBe(2);
    expect(out[1]?.totalMinor).toBe(2000);
  });

  it('uses Uncategorised bucket when categoryId is missing', () => {
    const list = [TX('a', '2026-08-01', 500)];
    const out = categoryTotals(list, '2026-08');
    expect(out).toHaveLength(1);
    expect(out[0]?.categoryId).toBeUndefined();
    expect(out[0]?.categoryName).toBe('Uncategorised');
  });
});

describe('paymentMethodTotals', () => {
  it('groups by paymentMethod', () => {
    const list: TrackTransaction[] = [
      { ...TX('a', '2026-08-01', 1000), paymentMethod: 'upi' },
      { ...TX('b', '2026-08-02', 2000), paymentMethod: 'cash' },
      { ...TX('c', '2026-08-03', 500), paymentMethod: 'upi' },
    ];
    const out = paymentMethodTotals(list, '2026-08');
    expect(out).toHaveLength(2);
    // sorted desc: cash (2000) then upi (1500)
    expect(out[0]?.totalMinor).toBe(2000);
    expect(out[0]?.paymentMethod).toBe('cash');
    expect(out[1]?.totalMinor).toBe(1500);
    expect(out[1]?.paymentMethod).toBe('upi');
  });
});

describe('dailyTotals', () => {
  it('emits one row per day of the month', () => {
    const out = dailyTotals([], '2026-02'); // 2026 not a leap year
    expect(out).toHaveLength(28);
    expect(out[0]?.day).toBe('2026-02-01');
    expect(out[27]?.day).toBe('2026-02-28');
  });

  it('sums the values for matching days', () => {
    const list = [TX('a', '2026-08-05', 1000), TX('b', '2026-08-05', 2000), TX('c', '2026-08-10', 700)];
    const out = dailyTotals(list, '2026-08');
    expect(out.find((d) => d.day === '2026-08-05')?.totalMinor).toBe(3000);
    expect(out.find((d) => d.day === '2026-08-10')?.totalMinor).toBe(700);
  });
});

describe('filterTransactions', () => {
  const list: TrackTransaction[] = [
    { ...TX('a', '2026-08-01', 1000), categoryId: 'food', paymentMethod: 'upi', note: 'lunch with team' },
    { ...TX('b', '2026-08-15', 2000), categoryId: 'travel', paymentMethod: 'card' },
    { ...TX('c', '2026-08-20', 3000, 'income'), categoryId: 'salary' },
    { ...TX('d', '2026-07-31', 9999), categoryId: 'food' }, // wrong month
  ];

  it('filters by type', () => {
    expect(filterTransactions(list, { type: 'income' })).toHaveLength(1);
  });

  it('filters by categoryId', () => {
    expect(filterTransactions(list, { categoryId: 'food' })).toHaveLength(2);
  });

  it('filters by paymentMethod', () => {
    expect(filterTransactions(list, { paymentMethod: 'upi' })).toHaveLength(1);
  });

  it('filters by month', () => {
    expect(filterTransactions(list, { month: '2026-08' })).toHaveLength(3);
  });

  it('text search matches title and note', () => {
    expect(filterTransactions(list, { text: 'lunch' })).toHaveLength(1);
    expect(filterTransactions(list, { text: 'food' })).toHaveLength(0); // not in text
  });

  it('date range inclusive', () => {
    expect(filterTransactions(list, { fromDate: '2026-08-15', toDate: '2026-08-20' })).toHaveLength(2);
  });

  it('excludes soft-deleted by default', () => {
    const withDeleted = [...list, { ...TX('e', '2026-08-22', 100), deletedAt: '2026-08-22' }];
    expect(filterTransactions(withDeleted)).toHaveLength(4);
  });
});

describe('budgetProgress', () => {
  const tx = [TX('a', '2026-08-01', 20000), TX('b', '2026-08-10', 10000)];

  it('returns 0 percent when no budget set', () => {
    expect(budgetProgress(tx, '2026-08', undefined)).toEqual({
      amountMinor: 0,
      spentMinor: 30000,
      remainingMinor: 0,
      percent: 0,
    });
  });

  it('computes remaining and percent under-budget', () => {
    const result = budgetProgress(tx, '2026-08', { amountMinor: 50000 });
    expect(result.spentMinor).toBe(30000);
    expect(result.remainingMinor).toBe(20000);
    expect(result.percent).toBe(60);
  });

  it('reports negative remaining and >=100 percent when over-budget', () => {
    const result = budgetProgress(tx, '2026-08', { amountMinor: 20000 });
    expect(result.remainingMinor).toBe(-10000);
    expect(result.percent).toBe(150);
  });

  it('excludes income from spent', () => {
    const txs = [...tx, TX('inc', '2026-08-15', 1000000, 'income')];
    const result = budgetProgress(txs, '2026-08', { amountMinor: 50000 });
    expect(result.spentMinor).toBe(30000);
  });
});

describe('recentTransactions', () => {
  it('returns the N most recent by date desc', () => {
    const list = [
      TX('a', '2026-08-01', 100),
      TX('b', '2026-08-15', 200),
      TX('c', '2026-08-10', 300),
    ];
    const recent = recentTransactions(list, 2);
    expect(recent.map((t) => t.id)).toEqual(['b', 'c']);
  });

  it('excludes soft-deleted', () => {
    const list = [TX('a', '2026-08-01', 100), { ...TX('b', '2026-08-15', 200), deletedAt: '2026-08-15' }];
    expect(recentTransactions(list, 5)).toHaveLength(1);
  });
});
