/**
 * SplitShare repository.
 *
 * Mirror of `splitPayerRepository` for the share side of an
 * expense. Most writes happen atomically via
 * `splitExpenseRepository.createAtomic`.
 */

import { getDB } from '@db/database';
import type { SplitShare } from '@db/schema';

export const splitShareRepository = {
  /** All shares for a single expense. */
  async listForExpense(expenseId: string): Promise<SplitShare[]> {
    return getDB().splitShares.where('expenseId').equals(expenseId).toArray();
  },

  /** All shares for every expense in a group. */
  async listForGroup(groupId: string): Promise<SplitShare[]> {
    const db = getDB();
    const expenses = await db.splitExpenses.where('groupId').equals(groupId).toArray();
    const ids = new Set(expenses.map((e) => e.id));
    if (ids.size === 0) return [];
    const all = await db.splitShares.toArray();
    return all.filter((s) => ids.has(s.expenseId));
  },

  async replaceAllForExpense(expenseId: string, shares: SplitShare[]): Promise<void> {
    const db = getDB();
    await db.transaction('rw', db.splitShares, async () => {
      const existing = await db.splitShares.where('expenseId').equals(expenseId).toArray();
      for (const s of existing) await db.splitShares.delete(s.id);
      if (shares.length > 0) await db.splitShares.bulkPut(shares);
    });
  },

  async replaceAllForGroup(groupId: string, shares: SplitShare[]): Promise<void> {
    const db = getDB();
    const expenses = await db.splitExpenses.where('groupId').equals(groupId).toArray();
    const ids = new Set(expenses.map((e) => e.id));
    await db.transaction('rw', db.splitShares, async () => {
      const existing = await db.splitShares.toArray();
      for (const s of existing) {
        if (ids.has(s.expenseId)) await db.splitShares.delete(s.id);
      }
      if (shares.length > 0) await db.splitShares.bulkPut(shares);
    });
  },

  async bulkAdd(shares: SplitShare[]): Promise<void> {
    if (shares.length === 0) return;
    await getDB().splitShares.bulkAdd(shares);
  },
};

export type SplitShareRepository = typeof splitShareRepository;
