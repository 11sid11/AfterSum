/**
 * SplitExpense repository.
 *
 * Owns the Dexie `splitExpenses` table and orchestrates
 * atomic creation of an expense together with its payer
 * and share rows (work.md §35: "either all succeed or
 * none succeed").
 *
 * All writes go through the `runTransaction` helper so
 * they commit or roll back as a single unit.
 */

import { getDB } from '@db/database';
import { runTransaction } from '@db/transaction';
import {
  repoCreate,
  repoUpdate,
  repoSoftDelete,
  repoRestore,
  type CreateInput,
} from '@db/repositories/base';
import { newId, prefixedId } from '@shared/ids';
import { nowISO } from '@shared/dates';
import type { SplitExpense, SplitPayer, SplitShare } from '@db/schema';
import { SplitExpenseInputSchema, type SplitExpenseInput } from '../domain/validation';
import {
  computeEqualShares,
  computeExactShares,
  computePercentageShares,
  computeShareWeightedShares,
} from '../domain/splits';
import { assertExpenseInvariants } from '../domain/validation';

export const splitExpenseRepository = {
  /** All non-deleted expenses. */
  async list(): Promise<SplitExpense[]> {
    const all = await getDB().splitExpenses.toArray();
    return all
      .filter((e) => !e.deletedAt)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  /** All non-deleted expenses for a group. */
  async listForGroup(groupId: string): Promise<SplitExpense[]> {
    const all = await getDB().splitExpenses.where('groupId').equals(groupId).toArray();
    return all
      .filter((e) => !e.deletedAt)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  /** Single expense by id. */
  async get(id: string): Promise<SplitExpense | undefined> {
    return getDB().splitExpenses.get(id);
  },

  /**
   * Create a new expense with all its payers and shares in a
   * single transaction. The caller supplies the validated
   * SplitExpenseInput. The function computes the final
   * per-person share amounts using the chosen split method,
   * re-validates the totals, and writes all rows atomically.
   *
   * Returns the persisted expense id, payer ids, and share ids.
   */
  async createAtomic(input: SplitExpenseInput): Promise<{
    expense: SplitExpense;
    payers: SplitPayer[];
    shares: SplitShare[];
  }> {
    // 1) Schema-validate the wrapper.
    const parsed = SplitExpenseInputSchema.parse(input);

    // 2) Compute final share amounts per participant, in the
    //    order declared by `participantIds`.
    let shares: number[];
    switch (parsed.allocation.method) {
      case 'equal':
        shares = computeEqualShares(parsed.amountMinor, parsed.participantIds);
        break;
      case 'exact':
        shares = computeExactShares(
          parsed.amountMinor,
          parsed.participantIds,
          parsed.allocation.amountsByPersonId,
        );
        break;
      case 'percentage':
        shares = computePercentageShares(
          parsed.amountMinor,
          parsed.participantIds,
          parsed.allocation.percentagesByPersonId,
        );
        break;
      case 'shares':
        shares = computeShareWeightedShares(
          parsed.amountMinor,
          parsed.participantIds,
          parsed.allocation.sharesByPersonId,
        );
        break;
    }

    // 3) Re-validate cross-field invariants now that we have
    //    the resolved share amounts. This is the final
    //    guarantee that the persisted rows balance exactly.
    assertExpenseInvariants({
      amountMinor: parsed.amountMinor,
      payers: parsed.payers,
      shares: parsed.participantIds.map((pid, i) => ({
        personId: pid,
        amountMinor: shares[i] ?? 0,
      })),
      splitMethod: parsed.splitMethod,
      allocation: parsed.allocation,
    });

    // 4) Build all rows up front (we can't safely call async
    //    repo helpers inside the transaction body without
    //    nesting transactions, so we write the rows directly
    //    with the same base semantics as repoCreate).
    const now = nowISO();
    const expenseId = prefixedId('exp');
    const expense: SplitExpense = {
      id: expenseId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      groupId: parsed.groupId,
      title: parsed.title.trim(),
      amountMinor: parsed.amountMinor,
      currency: parsed.currency,
      date: parsed.date,
      splitMethod: parsed.splitMethod,
      note: parsed.note || undefined,
    };
    const payerRows: SplitPayer[] = parsed.payers.map((p) => ({
      id: prefixedId('pay'),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      expenseId,
      personId: p.personId,
      amountMinor: p.amountMinor,
    }));
    const shareRows: SplitShare[] = parsed.participantIds.map((pid, i) => ({
      id: prefixedId('shr'),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      expenseId,
      personId: pid,
      amountMinor: shares[i] ?? 0,
    }));

    // 5) Write all three tables in one transaction.
    await runTransaction(
      ['splitExpenses', 'splitPayers', 'splitShares'],
      'readwrite',
      async () => {
        await getDB().splitExpenses.add(expense);
        if (payerRows.length > 0) await getDB().splitPayers.bulkAdd(payerRows);
        if (shareRows.length > 0) await getDB().splitShares.bulkAdd(shareRows);
      },
    );

    return { expense, payers: payerRows, shares: shareRows };
  },

  /** Patch an existing expense. Does NOT touch payers or shares. */
  async update(id: string, patch: Partial<Omit<SplitExpense, 'id' | 'createdAt' | 'revision' | 'groupId'>>): Promise<SplitExpense> {
    const next: Partial<SplitExpense> = { ...patch };
    if (next.note === '') next.note = undefined;
    return repoUpdate<SplitExpense>(getDB().splitExpenses, id, next);
  },

  /**
   * Soft-delete an expense. Per work.md §12, the row stays
   * in the table with `deletedAt` set; balance queries filter
   * them out. Payer/share rows are left as-is because the
   * join filters on the expense's deletedAt.
   */
  async softDelete(id: string): Promise<void> {
    return repoSoftDelete(getDB().splitExpenses, id);
  },

  /** Restore a soft-deleted expense. */
  async restore(id: string): Promise<void> {
    return repoRestore(getDB().splitExpenses, id);
  },

  /**
   * Bulk replace expenses + their child rows. Used by JSON
   * restore. All three tables are cleared and re-populated
   * in a single transaction.
   */
  async replaceAll(
    expenses: SplitExpense[],
    payers: SplitPayer[],
    shares: SplitShare[],
  ): Promise<void> {
    const db = getDB();
    await db.transaction('rw', db.splitExpenses, db.splitPayers, db.splitShares, async () => {
      await db.splitExpenses.clear();
      await db.splitPayers.clear();
      await db.splitShares.clear();
      if (expenses.length > 0) await db.splitExpenses.bulkPut(expenses);
      if (payers.length > 0) await db.splitPayers.bulkPut(payers);
      if (shares.length > 0) await db.splitShares.bulkPut(shares);
    });
  },
};

export type SplitExpenseRepository = typeof splitExpenseRepository;

// Keep references live for downstream type usage without
// dragging unused-import lints in here.
void newId;
void repoCreate;
void CreateInput;
