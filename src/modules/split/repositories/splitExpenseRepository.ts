/** Split expense persistence. */
import { getDB } from '@db/database';
import { runTransaction } from '@db/transaction';
import { repoUpdate, repoSoftDelete, repoRestore } from '@db/repositories/base';
import { prefixedId } from '@shared/ids';
import { nowISO } from '@shared/dates';
import type { SplitExpense, SplitPayer, SplitShare } from '@db/schema';
import { SplitExpenseInputSchema, type SplitExpenseInput, assertExpenseInvariants } from '../domain/validation';
import { computeEqualShares, computeExactShares, computePercentageShares, computeShareWeightedShares } from '../domain/splits';

export const splitExpenseRepository = {
  async list(): Promise<SplitExpense[]> {
    const all = await getDB().splitExpenses.toArray();
    return all.filter((expense) => !expense.deletedAt).sort((a, b) => (a.date < b.date ? 1 : -1));
  },
  async listForGroup(groupId: string): Promise<SplitExpense[]> {
    const all = await getDB().splitExpenses.where('groupId').equals(groupId).toArray();
    return all.filter((expense) => !expense.deletedAt).sort((a, b) => (a.date < b.date ? 1 : -1));
  },
  async get(id: string): Promise<SplitExpense | undefined> {
    return getDB().splitExpenses.get(id);
  },
  async createAtomic(input: SplitExpenseInput): Promise<{ expense: SplitExpense; payers: SplitPayer[]; shares: SplitShare[] }> {
    const parsed = SplitExpenseInputSchema.parse(input);
    let shares: number[];
    switch (parsed.allocation.method) {
      case 'equal':
        shares = computeEqualShares(parsed.amountMinor, parsed.participantIds);
        break;
      case 'exact':
        shares = computeExactShares(parsed.amountMinor, parsed.participantIds, parsed.allocation.amountsByPersonId);
        break;
      case 'percentage':
        shares = computePercentageShares(parsed.amountMinor, parsed.participantIds, parsed.allocation.percentagesByPersonId);
        break;
      case 'shares':
        shares = computeShareWeightedShares(parsed.amountMinor, parsed.participantIds, parsed.allocation.sharesByPersonId);
        break;
    }
    assertExpenseInvariants({
      amountMinor: parsed.amountMinor,
      payers: parsed.payers,
      shares: parsed.participantIds.map((personId, index) => ({ personId, amountMinor: shares[index] ?? 0 })),
      splitMethod: parsed.splitMethod,
      allocation: parsed.allocation,
    });
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
      category: parsed.category,
      note: parsed.note || undefined,
      originalCurrency: parsed.originalCurrency,
      originalAmountMinor: parsed.originalAmountMinor,
      exchangeRate: parsed.exchangeRate,
      items: parsed.items,
      recurrenceTemplateId: parsed.recurrenceTemplateId,
      recurrenceOccurrenceDate: parsed.recurrenceOccurrenceDate,
      importSourceKey: parsed.importSourceKey,
    };
    const payerRows: SplitPayer[] = parsed.payers.map((payer) => ({
      id: prefixedId('pay'), createdAt: now, updatedAt: now, revision: 1,
      expenseId, personId: payer.personId, amountMinor: payer.amountMinor,
    }));
    const shareRows: SplitShare[] = parsed.participantIds.map((personId, index) => ({
      id: prefixedId('shr'), createdAt: now, updatedAt: now, revision: 1,
      expenseId, personId, amountMinor: shares[index] ?? 0,
    }));
    await runTransaction(['splitExpenses', 'splitPayers', 'splitShares'], 'readwrite', async () => {
      await getDB().splitExpenses.add(expense);
      if (payerRows.length > 0) await getDB().splitPayers.bulkAdd(payerRows);
      if (shareRows.length > 0) await getDB().splitShares.bulkAdd(shareRows);
    });
    return { expense, payers: payerRows, shares: shareRows };
  },
  async update(id: string, patch: Partial<Omit<SplitExpense, 'id' | 'createdAt' | 'revision' | 'groupId'>>): Promise<SplitExpense> {
    const next: Partial<SplitExpense> = { ...patch };
    if (next.note === '') next.note = undefined;
    return repoUpdate<SplitExpense>(getDB().splitExpenses, id, next);
  },
  async softDelete(id: string): Promise<void> {
    return repoSoftDelete(getDB().splitExpenses, id);
  },
  async restore(id: string): Promise<void> {
    return repoRestore(getDB().splitExpenses, id);
  },
  async replaceAll(expenses: SplitExpense[], payers: SplitPayer[], shares: SplitShare[]): Promise<void> {
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
