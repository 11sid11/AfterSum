/**
 * TrackTransaction repository.
 *
 * Owns the Dexie `trackTransactions` table. The Track module
 * is the ONLY writer of this table.
 *
 * Amounts are integer minor units; the type field
 * (`expense` / `income`) carries the direction. The user
 * never enters a negative amount.
 */

import { getDB } from '@db/database';
import {
  repoCreate,
  repoUpdate,
  repoSoftDelete,
  repoRestore,
  type CreateInput,
} from '@db/repositories/base';
import {
  TrackTransactionInputSchema,
  cleanTransactionInput,
  type TrackTransactionInput,
} from '../domain/validation';
import { monthDateRange } from '@shared/dates';
import type { TrackTransaction } from '@db/schema';

function clean(input: Partial<TrackTransactionInput>): Partial<TrackTransactionInput> {
  const merged = {
    ...input,
    categoryId: input.categoryId || undefined,
    paymentMethod: input.paymentMethod || undefined,
    note: input.note || undefined,
  };
  return cleanTransactionInput(merged as TrackTransactionInput);
}

function newestDateFirst(a: TrackTransaction, b: TrackTransaction): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
}

export const trackTransactionRepository = {
  /** All active (non-deleted) transactions, newest date first. */
  async list(): Promise<TrackTransaction[]> {
    const all = await getDB().trackTransactions.toArray();
    return all.filter((transaction) => !transaction.deletedAt).sort(newestDateFirst);
  },

  /** Active transactions within a single month (YYYY-MM). */
  async listByMonth(month: string): Promise<TrackTransaction[]> {
    const { fromInclusive, toExclusive } = monthDateRange(month);
    const rows = await getDB()
      .trackTransactions.where('date')
      .between(fromInclusive, toExclusive, true, false)
      .toArray();
    return rows.filter((transaction) => !transaction.deletedAt).sort(newestDateFirst);
  },

  /** Active transactions within an inclusive [fromDate, toDate] range. */
  async listByDateRange(fromDate: string, toDate: string): Promise<TrackTransaction[]> {
    const rows = await getDB()
      .trackTransactions.where('date')
      .between(fromDate, toDate, true, true)
      .toArray();
    return rows.filter((transaction) => !transaction.deletedAt).sort(newestDateFirst);
  },

  async get(id: string): Promise<TrackTransaction | undefined> {
    return getDB().trackTransactions.get(id);
  },

  async create(input: TrackTransactionInput): Promise<TrackTransaction> {
    const parsed = TrackTransactionInputSchema.parse(input);
    const cleaned = clean(parsed);
    return repoCreate<TrackTransaction>(getDB().trackTransactions, cleaned as CreateInput<TrackTransaction>);
  },

  async update(id: string, patch: Partial<TrackTransactionInput>): Promise<TrackTransaction> {
    const parsed = TrackTransactionInputSchema.partial().parse(patch);
    return repoUpdate<TrackTransaction>(getDB().trackTransactions, id, clean(parsed));
  },

  async softDelete(id: string): Promise<void> {
    return repoSoftDelete(getDB().trackTransactions, id);
  },

  async restore(id: string): Promise<void> {
    return repoRestore(getDB().trackTransactions, id);
  },

  /** Bulk-replace (used by JSON restore). */
  async replaceAll(transactions: TrackTransaction[]): Promise<void> {
    const db = getDB();
    await db.trackTransactions.clear();
    if (transactions.length > 0) await db.trackTransactions.bulkPut(transactions);
  },
};

export type TrackTransactionRepository = typeof trackTransactionRepository;
