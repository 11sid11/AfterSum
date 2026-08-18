/**
 * Track module — live queries.
 *
 * Thin wrappers around `useLiveQuery` that read from Dexie.
 * All React components should consume these instead of
 * touching the DB directly.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import { monthDateRange, todayDateOnly } from '@shared/dates';
import { useAppSettings } from '@shared/settings/useSettings';
import {
  budgetProgress as budgetProgressCalc,
  categoryTotals as categoryTotalsCalc,
  decorateWithCategory,
  filterTransactions,
  monthlyTotal as monthlyTotalCalc,
  paymentMethodTotals as paymentMethodTotalsCalc,
} from '../services/aggregations';
import type { TrackTransaction, TrackCategory, TrackBudget, TrackRecurringRule } from '@db/schema';
import type {
  CategoryTotal,
  MonthlySummary,
  PaymentMethodTotal,
  TrackTransactionFilters,
  TrackTransactionWithCategory,
} from '../domain/types';

const EMPTY_FILTERS: TrackTransactionFilters = {};

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
  filters: TrackTransactionFilters = EMPTY_FILTERS,
): TrackTransactionWithCategory[] | undefined {
  const categoriesById = useTrackCategoryMap();
  return useLiveQuery(
    async () => {
      const { fromInclusive, toExclusive } = monthDateRange(month);
      const monthRows = await getDB()
        .trackTransactions.where('date')
        .between(fromInclusive, toExclusive, true, false)
        .toArray();
      const filtered = filterTransactions(monthRows, filters);
      if (!categoriesById) return filtered.map((t) => ({ ...t }));
      return decorateWithCategory(filtered, categoriesById);
    },
    [month, filters, categoriesById],
  );
}

/** All active transactions across months (filtered), decorated. */
export function useTrackTransactions(
  filters: TrackTransactionFilters = EMPTY_FILTERS,
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
    async () =>
      getDB()
        .trackBudgets.where('month')
        .equals(month)
        .filter((budget) => !budget.deletedAt)
        .first(),
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
      const { fromInclusive, toExclusive } = monthDateRange(month);
      const [monthTx, budgetRow, allCategories] = await Promise.all([
        db.trackTransactions.where('date').between(fromInclusive, toExclusive, true, false).toArray(),
        db.trackBudgets.where('month').equals(month).filter((budget) => !budget.deletedAt).first(),
        db.trackCategories.toArray(),
      ]);
      const currency = settings?.defaultCurrency ?? 'INR';
      const spent = monthlyTotalCalc(monthTx, month, 'expense');
      const income = monthlyTotalCalc(monthTx, month, 'income');
      const categoryNames = new Map(
        allCategories.filter((category) => !category.deletedAt).map((category) => [category.id, category.name]),
      );
      const byCategory = categoryTotalsCalc(monthTx, month, 'expense').map<CategoryTotal>((c) => ({
        ...c,
        categoryName: c.categoryId
          ? categoryNames.get(c.categoryId) ?? 'Uncategorised'
          : 'Uncategorised',
      }));
      const byPaymentMethod = paymentMethodTotalsCalc(monthTx, month, 'expense');
      const prog = budgetProgressCalc(
        monthTx,
        month,
        budgetRow ? { amountMinor: budgetRow.amountMinor } : undefined,
      );
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
      const recent = await getDB()
        .trackTransactions.orderBy('date')
        .reverse()
        .filter((transaction) => !transaction.deletedAt)
        .limit(limit)
        .toArray();
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
    return getDB()
      .trackRecurringRules.where('nextDate')
      .belowOrEqual(today)
      .filter((rule) => !rule.deletedAt && rule.enabled)
      .sortBy('nextDate');
  }, []);
}

// Re-export useful types
export type { CategoryTotal, PaymentMethodTotal, TrackTransactionWithCategory };
// (TrackTransaction / TrackCategory / TrackBudget / TrackRecurringRule imported above; not re-exported to avoid clashing with @db/schema exports.)
export type { TrackTransaction, TrackCategory, TrackBudget, TrackRecurringRule };
