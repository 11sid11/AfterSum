/**
 * TrackBudget repository.
 *
 * Owns the Dexie `trackBudgets` table. V1: at most one budget
 * per (month, currency) pair; we treat the first one created
 * as authoritative.
 */

import { getDB } from '@db/database';
import {
  repoCreate,
  repoUpdate,
  repoSoftDelete,
  type CreateInput,
} from '@db/repositories/base';
import { TrackBudgetInputSchema, type TrackBudgetInput } from '../domain/validation';
import type { TrackBudget } from '@db/schema';

export const trackBudgetRepository = {
  /** The active budget for a given month, or undefined. */
  async getByMonth(month: string): Promise<TrackBudget | undefined> {
    const all = await getDB().trackBudgets.toArray();
    return all.find((b) => !b.deletedAt && b.month === month);
  },

  /** All active budgets (across months), sorted by month desc. */
  async listAll(): Promise<TrackBudget[]> {
    const all = await getDB().trackBudgets.toArray();
    return all
      .filter((b) => !b.deletedAt)
      .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));
  },

  /**
   * Upsert the budget for a (month, currency) pair. If a row
   * already exists, update it; otherwise create one.
   */
  async setForMonth(input: TrackBudgetInput): Promise<TrackBudget> {
    const parsed = TrackBudgetInputSchema.parse(input);
    const existing = await trackBudgetRepository.getByMonth(parsed.month);
    if (existing) {
      return repoUpdate<TrackBudget>(getDB().trackBudgets, existing.id, parsed);
    }
    return repoCreate<TrackBudget>(getDB().trackBudgets, parsed as CreateInput<TrackBudget>);
  },

  async delete(id: string): Promise<void> {
    return repoSoftDelete(getDB().trackBudgets, id);
  },

  async deleteByMonth(month: string): Promise<void> {
    const cur = await trackBudgetRepository.getByMonth(month);
    if (cur) return repoSoftDelete(getDB().trackBudgets, cur.id);
  },

  /** Bulk-replace (used by JSON restore). */
  async replaceAll(budgets: TrackBudget[]): Promise<void> {
    const db = getDB();
    await db.trackBudgets.clear();
    if (budgets.length > 0) await db.trackBudgets.bulkPut(budgets);
  },
};

export type TrackBudgetRepository = typeof trackBudgetRepository;
