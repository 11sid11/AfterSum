/**
 * Track module — live queries.
 *
 * Thin wrappers around `useLiveQuery` that read from Dexie.
 * All React components should consume these instead of
 * touching the DB directly.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import { todayDateOnly } from '@shared/dates';
import { useAppSettings } from '@shared/settings/useSettings';
import {
  budgetProgress as budgetProgressCalc,
  categoryTotals as categoryTotalsCalc,
  decorateWithCategory,
  filterTransactions,
  monthlyTotal as monthlyTotalCalc,
  paymentMethodTotals as paymentMethodTotalsCalc,
  recentTransactions as recentTransactionsCalc,
} from '../services/aggregations';
import type { TrackTransaction, TrackCategory, TrackBudget, TrackRecurringRule } from '@db/schema';
import type {
  CategoryTotal,
  MonthlySummary,
  PaymentMethodTotal,
  TrackTransactionFilters,
  TrackTransactionWithCategory,
} from '../domain/types';

/** All active categories, optionally filtered by type. */
export function useTrackCategories(
  type?: 'expense' | 'income',
  includeArchived = false,
): TrackCategory[] | undefined {
  return useLiveQuery(
    async () => {
      const all = await getDB().trackCategories.toArray();
      return all
        .filter((c) => !c.deletedAt)
        .filter((c) => (includeArchived ? true : !c.archived))
        .filter((c) => (type ? c.type === type : true))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    [type, includeArchived],
  );
}

/** All active categories as a Map<id, category> for quick joins. */
export function useTrackCategoryMap(): Map<string, TrackCategory> | undefined {
  return useLiveQuery(async () => {
    const all = await getDB().trackCategories.toArray();
    const map = new Map<string, TrackCategory>();
    for (const c of all) {
      if (!c.deletedAt) map.set(c.id, c);
    }
    return map;
  }, []);
}

/** Active transactions for a month, decorated with their category. */
export function useTrackTransactionsForMonth(
  month: string,
  filters: TrackTransactionFilters = {},
): TrackTransactionWithCategory[] | undefined {
  const categoriesById = useTrackCategoryMap();
  return useLiveQuery(
    async () => {
      const all = await getDB().trackTransactions.toArray();
      const filtered = filterTransactions(all, { ...filters, month });
      if (!categoriesById) return filtered.map((t) => ({ ...t }));
      return decorateWithCategory(filtered, categoriesById);
    },
    [month, filters, categoriesById],
  );
}

/** All active transactions across months (filtered), decorated. */
export function useTrackTransactions(
  filters: TrackTransactionFilters = {},
): TrackTransactionWithCategory[] | undefined {
  const categoriesById = useTrackCategoryMap();
  return useLiveQuery(
    async () => {
      const all = await getDB().trackTransactions.toArray();
      const filtered = filterTransactions(all, filters);
      if (!categoriesById) return filtered.map((t) => ({ ...t }));
      return decorateWithCategory(filtered, categoriesById);
    },
    [filters, categoriesById],
  );
}

/** A single transaction by id, decorated with its category. */
export function useTrackTransaction(id: string | undefined): TrackTransactionWithCategory | undefined {
  const categoriesById = useTrackCategoryMap();
  return useLiveQuery(
    async () => {
      if (!id) return undefined;
      const t = await getDB().trackTransactions.get(id);
      if (!t) return undefined;
      const cat = t.categoryId ? categoriesById?.get(t.categoryId) : undefined;
      return { ...t, category: cat };
    },
    [id, categoriesById],
  );
}

/** The budget for a given month, or undefined. */
export function useTrackBudget(month: string): TrackBudget | undefined {
  return useLiveQuery(
    async () => {
      const all = await getDB().trackBudgets.toArray();
      return all.find((b) => !b.deletedAt && b.month === month);
    },
    [month],
  );
}

/**
 * Everything needed to render a Track month page:
 *  - spent / income totals
 *  - by category, by payment method
 *  - budget progress
 */
export function useTrackMonthlySummary(month: string): MonthlySummary | undefined {
  const settings = useAppSettings();
  return useLiveQuery(
    async () => {
      const db = getDB();
      const [allTx, allBudgets, allCategories] = await Promise.all([
        db.trackTransactions.toArray(),
        db.trackBudgets.toArray(),
        db.trackCategories.toArray(),
      ]);
      const currency = settings?.defaultCurrency ?? 'INR';
      const spent = monthlyTotalCalc(allTx, month, 'expense');
      const income = monthlyTotalCalc(allTx, month, 'income');
      const byCategory = categoryTotalsCalc(allTx, month, 'expense').map<CategoryTotal>((c) => ({
        ...c,
        categoryName: c.categoryId
          ? allCategories.find((x) => x.id === c.categoryId)?.name ?? 'Uncategorised'
          : 'Uncategorised',
      }));
      const byPaymentMethod = paymentMethodTotalsCalc(allTx, month, 'expense');
      const budgetRow = allBudgets.find((b) => !b.deletedAt && b.month === month);
      const prog = budgetProgressCalc(allTx, month, budgetRow ? { amountMinor: budgetRow.amountMinor } : undefined);
      const summary: MonthlySummary = {
        month,
        currency,
        spentMinor: spent,
        incomeMinor: income,
        byCategory,
        byPaymentMethod,
      };
      if (budgetRow) {
        summary.budget = {
          amountMinor: prog.amountMinor,
          spentMinor: prog.spentMinor,
          remainingMinor: prog.remainingMinor,
          percent: prog.percent,
        };
      }
      return summary;
    },
    [month, settings?.defaultCurrency],
  );
}

/** Active recurring rules. */
export function useTrackRecurring(): TrackRecurringRule[] | undefined {
  return useLiveQuery(async () => {
    const all = await getDB().trackRecurringRules.toArray();
    return all
      .filter((r) => !r.deletedAt)
      .sort((a, b) => (a.nextDate < b.nextDate ? -1 : a.nextDate > b.nextDate ? 1 : 0));
  }, []);
}

/** The N most recent active transactions, decorated with category. */
export function useRecentTrackTransactions(limit = 5): TrackTransactionWithCategory[] | undefined {
  const categoriesById = useTrackCategoryMap();
  return useLiveQuery(
    async () => {
      const all = await getDB().trackTransactions.toArray();
      const recent = recentTransactionsCalc(all, limit);
      if (!categoriesById) return recent.map((t) => ({ ...t }));
      return decorateWithCategory(recent, categoriesById);
    },
    [limit, categoriesById],
  );
}

/** Active recurring rules due on or before today. */
export function useTrackRecurringDue(): TrackRecurringRule[] | undefined {
  return useLiveQuery(async () => {
    const today = todayDateOnly();
    const all = await getDB().trackRecurringRules.toArray();
    return all
      .filter((r) => !r.deletedAt && r.enabled && r.nextDate <= today)
      .sort((a, b) => (a.nextDate < b.nextDate ? -1 : a.nextDate > b.nextDate ? 1 : 0));
  }, []);
}

// Re-export useful types
export type { CategoryTotal, PaymentMethodTotal, TrackTransactionWithCategory };
// (TrackTransaction / TrackCategory / TrackBudget / TrackRecurringRule imported above; not re-exported to avoid clashing with @db/schema exports.)
export type { TrackTransaction, TrackCategory, TrackBudget, TrackRecurringRule };
