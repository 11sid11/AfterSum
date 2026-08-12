/**
 * SplitPayer repository.
 *
 * Owns the Dexie `splitPayers` table. Most writes happen
 * atomically as part of `splitExpenseRepository.createAtomic`
 * — the helpers in this file are for bulk operations and
 * administrative repairs (e.g. JSON restore).
 */

import { getDB } from '@db/database';
import type { SplitPayer } from '@db/schema';

export const splitPayerRepository = {
  /** All payers for a single expense. */
  async listForExpense(expenseId: string): Promise<SplitPayer[]> {
    return getDB().splitPayers.where('expenseId').equals(expenseId).toArray();
  },

  /**
   * All payers for every expense in a group. Used by the
   * balance engine when computing per-member aggregates.
   */
  async listForGroup(groupId: string): Promise<SplitPayer[]> {
    const db = getDB();
    const expenses = await db.splitExpenses.where('groupId').equals(groupId).toArray();
    const ids = new Set(expenses.map((e) => e.id));
    if (ids.size === 0) return [];
    const all = await db.splitPayers.toArray();
    return all.filter((p) => ids.has(p.expenseId));
  },

  /**
   * Replace the payer rows for a single expense. This is
   * NOT the normal write path; it's used by the JSON restore
   * step and by future edit-expense flows.
   */
  async replaceAllForExpense(expenseId: string, payers: SplitPayer[]): Promise<void> {
    const db = getDB();
    await db.transaction('rw', db.splitPayers, async () => {
      const existing = await db.splitPayers.where('expenseId').equals(expenseId).toArray();
      for (const p of existing) await db.splitPayers.delete(p.id);
      if (payers.length > 0) await db.splitPayers.bulkPut(payers);
    });
  },

  /**
   * Replace every payer row belonging to a group. Used by
   * JSON restore when only the group's data is being
   * rewritten.
   */
  async replaceAllForGroup(groupId: string, payers: SplitPayer[]): Promise<void> {
    const db = getDB();
    const expenses = await db.splitExpenses.where('groupId').equals(groupId).toArray();
    const ids = new Set(expenses.map((e) => e.id));
    await db.transaction('rw', db.splitPayers, async () => {
      const existing = await db.splitPayers.toArray();
      for (const p of existing) {
        if (ids.has(p.expenseId)) await db.splitPayers.delete(p.id);
      }
      if (payers.length > 0) await db.splitPayers.bulkPut(payers);
    });
  },

  /** Bulk insert. */
  async bulkAdd(payers: SplitPayer[]): Promise<void> {
    if (payers.length === 0) return;
    await getDB().splitPayers.bulkAdd(payers);
  },
};

export type SplitPayerRepository = typeof splitPayerRepository;
