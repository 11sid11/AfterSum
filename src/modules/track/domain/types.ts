/**
 * Track module — type helpers.
 *
 * A "decorated" row is one with the category joined in. We
 * build it on the fly from `TrackTransaction + TrackCategory`
 * so we never need to persist the joined shape.
 */

import type { TrackCategory, TrackTransaction } from '@db/schema';

export interface TrackTransactionWithCategory extends TrackTransaction {
  category?: TrackCategory;
}

/** Useful for budget vs actual rows. */
export interface CategoryTotal {
  categoryId: string | undefined;
  categoryName: string;
  totalMinor: number;
  count: number;
}

/** Useful for "where did the money go this month" summaries. */
export interface MonthlySummary {
  month: string; // YYYY-MM
  currency: string;
  spentMinor: number;
  incomeMinor: number;
  byCategory: CategoryTotal[];
  byPaymentMethod: PaymentMethodTotal[];
  budget?: {
    amountMinor: number;
    spentMinor: number;
    remainingMinor: number;
    percent: number; // 0..100+, may exceed 100 when over-budget
  };
}

export interface PaymentMethodTotal {
  paymentMethod: TrackTransaction['paymentMethod'];
  totalMinor: number;
  count: number;
}

/** Common filter shape used by queries + list pages. */
export interface TrackTransactionFilters {
  type?: 'expense' | 'income';
  categoryId?: string;
  paymentMethod?: TrackTransaction['paymentMethod'];
  /** Free-text case-insensitive search across title + note. */
  text?: string;
  /** YYYY-MM-DD inclusive range. */
  fromDate?: string;
  toDate?: string;
  /** Override the "month" for month-scoped queries. */
  month?: string;
}
