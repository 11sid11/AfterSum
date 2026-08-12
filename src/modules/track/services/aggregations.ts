/**
 * Track module — pure aggregation & filter functions.
 *
 * No I/O, no React, no Dexie. All inputs are plain arrays of
 * already-loaded records. Components call these via the live
 * query hooks; tests exercise them directly.
 *
 * Money is integer minor units everywhere.
 */

import type { PaymentMethod, TrackTransaction } from '@db/schema';
import { isInMonth } from '@shared/dates';
import type {
  CategoryTotal,
  PaymentMethodTotal,
  TrackTransactionFilters,
  TrackTransactionWithCategory,
} from '../domain/types';

const ACTIVE = (t: TrackTransaction) => !t.deletedAt;

/** Sum the absolute amountMinor for the given month & type. */
export function monthlyTotal(
  transactions: TrackTransaction[],
  month: string,
  type?: 'expense' | 'income',
): number {
  let sum = 0;
  for (const t of transactions) {
    if (!ACTIVE(t)) continue;
    if (type && t.type !== type) continue;
    if (!isInMonth(t.date, month)) continue;
    sum += t.amountMinor;
  }
  return sum;
}

/** Group totals by category for a given month. */
export function categoryTotals(
  transactions: TrackTransaction[],
  month: string,
  type: 'expense' | 'income' = 'expense',
): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const t of transactions) {
    if (!ACTIVE(t)) continue;
    if (t.type !== type) continue;
    if (!isInMonth(t.date, month)) continue;
    const key = t.categoryId ?? '__uncategorised__';
    const existing =
      map.get(key) ??
      ({
        categoryId: t.categoryId,
        categoryName: 'Uncategorised',
        totalMinor: 0,
        count: 0,
      } as CategoryTotal);
    existing.totalMinor += t.amountMinor;
    existing.count += 1;
    map.set(key, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.totalMinor - a.totalMinor);
}

/** Group totals by payment method for a given month. */
export function paymentMethodTotals(
  transactions: TrackTransaction[],
  month: string,
  type: 'expense' | 'income' = 'expense',
): PaymentMethodTotal[] {
  const map = new Map<PaymentMethod | '__none__', PaymentMethodTotal>();
  for (const t of transactions) {
    if (!ACTIVE(t)) continue;
    if (t.type !== type) continue;
    if (!isInMonth(t.date, month)) continue;
    const key = t.paymentMethod ?? '__none__';
    const existing =
      map.get(key) ??
      ({
        paymentMethod: t.paymentMethod,
        totalMinor: 0,
        count: 0,
      } as PaymentMethodTotal);
    existing.totalMinor += t.amountMinor;
    existing.count += 1;
    map.set(key, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.totalMinor - a.totalMinor);
}

/** Per-day totals for a month. Days with no activity still appear as 0. */
export function dailyTotals(
  transactions: TrackTransaction[],
  month: string,
  type: 'expense' | 'income' = 'expense',
): Array<{ day: string; totalMinor: number }> {
  const byDay = new Map<string, number>();
  for (const t of transactions) {
    if (!ACTIVE(t)) continue;
    if (t.type !== type) continue;
    if (!isInMonth(t.date, month)) continue;
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amountMinor);
  }
  // Build out the full month so charts have all days.
  const [yy, mm] = month.split('-').map(Number);
  const lastDay = new Date(yy, mm, 0).getDate();
  const out: Array<{ day: string; totalMinor: number }> = [];
  for (let d = 1; d <= lastDay; d++) {
    const day = `${month}-${String(d).padStart(2, '0')}`;
    out.push({ day, totalMinor: byDay.get(day) ?? 0 });
  }
  return out;
}

/** Apply a filter set. Returns a new array. */
export function filterTransactions(
  transactions: TrackTransaction[],
  filters: TrackTransactionFilters = {},
): TrackTransaction[] {
  const text = filters.text?.trim().toLowerCase();
  return transactions.filter((t) => {
    if (t.deletedAt) return false;
    if (filters.type && t.type !== filters.type) return false;
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
    if (filters.paymentMethod && t.paymentMethod !== filters.paymentMethod) return false;
    if (filters.fromDate && t.date < filters.fromDate) return false;
    if (filters.toDate && t.date > filters.toDate) return false;
    if (filters.month && !isInMonth(t.date, filters.month)) return false;
    if (text) {
      const hay = `${t.title} ${t.note ?? ''}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

/** Decorate transactions with their categories (if any). */
export function decorateWithCategory(
  transactions: TrackTransaction[],
  categoriesById: Map<string, TrackTransactionWithCategory['category']>,
): TrackTransactionWithCategory[] {
  return transactions.map((t) => ({
    ...t,
    category: t.categoryId ? categoriesById.get(t.categoryId) : undefined,
  }));
}

/** Compute budget progress for a month. */
export interface BudgetProgress {
  amountMinor: number;
  spentMinor: number;
  remainingMinor: number;
  percent: number;
}

export function budgetProgress(
  transactions: TrackTransaction[],
  month: string,
  budget: TrackBudgetLike | undefined,
): BudgetProgress {
  const spent = monthlyTotal(transactions, month, 'expense');
  if (!budget || budget.amountMinor <= 0) {
    return { amountMinor: 0, spentMinor: spent, remainingMinor: 0, percent: 0 };
  }
  const remaining = budget.amountMinor - spent;
  const percent = Math.round((spent / budget.amountMinor) * 100);
  return {
    amountMinor: budget.amountMinor,
    spentMinor: spent,
    remainingMinor: remaining,
    percent,
  };
}

/** Minimal shape that `budgetProgress` accepts. */
export interface TrackBudgetLike {
  amountMinor: number;
}

/** The N most recent active transactions, newest first. */
export function recentTransactions(
  transactions: TrackTransaction[],
  limit: number,
): TrackTransaction[] {
  return transactions
    .filter(ACTIVE)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}
