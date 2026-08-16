/**
 * Live overview queries.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import { SELF_PERSON_ID } from '@db/seed';
import { toMonthKey, isInMonth } from '@shared/dates';
import { settingsRepository } from '@shared/settings/repository';
import { trackBudgetRepository } from '@modules/track/repositories/trackBudgetRepository';
import { computeMemberBalances } from '@modules/split/domain/balances';
import { entryToSignedAmount } from '@modules/lend/domain/signs';
import {
  trackToActivity,
  splitToActivity,
  splitSettlementToActivity,
  lendToActivity,
} from '../adapters';
import { calculateSplitPersonalShareForMonth } from '../projections/calculations';
import type { ActivityItem, OverviewSummary, PersonExposure } from '../projections/types';
import type { CurrencyCode } from '@shared/money';
import type { LendEntry } from '@db/schema';

function sumLendEntries(entries: Array<Pick<LendEntry, 'type' | 'amountMinor'>>): number {
  return entries.reduce((sum, entry) => sum + entryToSignedAmount(entry), 0);
}

export function useOverviewSummary(month: string = toMonthKey()): OverviewSummary | undefined {
  return useLiveQuery(async () => {
    const settings = await settingsRepository.get();
    const currency = settings.defaultCurrency;
    const db = getDB();

    const [trackAll, budget] = await Promise.all([
      db.trackTransactions.toArray(),
      trackBudgetRepository.getByMonth(month),
    ]);
    const trackActive = trackAll.filter((transaction) => !transaction.deletedAt);
    const monthTrack = trackActive.filter(
      (transaction) => isInMonth(transaction.date, month) && transaction.currency === currency,
    );
    const spentMinor = monthTrack
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
    const incomeMinor = monthTrack
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
    const budgetMinor = budget && budget.currency === currency ? budget.amountMinor : undefined;
    const budgetRemainingMinor = budgetMinor !== undefined ? budgetMinor - spentMinor : undefined;

    const [groupsAll, membersAll, expensesAll, payersAll, sharesAll, settlementsAll] =
      await Promise.all([
        db.splitGroups.toArray(),
        db.splitGroupMembers.toArray(),
        db.splitExpenses.toArray(),
        db.splitPayers.toArray(),
        db.splitShares.toArray(),
        db.splitSettlements.toArray(),
      ]);
    const groups = groupsAll.filter((group) => !group.deletedAt);
    const members = membersAll.filter((member) => !member.deletedAt);
    const expenses = expensesAll.filter((expense) => !expense.deletedAt);
    const payers = payersAll.filter((payer) => !payer.deletedAt);
    const shares = sharesAll.filter((share) => !share.deletedAt);
    const settlements = settlementsAll.filter((settlement) => !settlement.deletedAt);

    const splitShareMinor = calculateSplitPersonalShareForMonth({
      month,
      currency,
      selfPersonId: SELF_PERSON_ID,
      groups,
      expenses,
      shares,
    });

    let youAreOwedSplit = 0;
    let youOweSplit = 0;
    for (const group of groups) {
      if (group.currency !== currency) continue;
      const groupExpenses = expenses.filter((expense) => expense.groupId === group.id);
      const expenseIds = new Set(groupExpenses.map((expense) => expense.id));
      const balances = computeMemberBalances({
        group,
        members: members.filter((member) => member.groupId === group.id),
        expenses: groupExpenses,
        payers: payers.filter((payer) => expenseIds.has(payer.expenseId)),
        shares: shares.filter((share) => expenseIds.has(share.expenseId)),
        settlements: settlements.filter((settlement) => settlement.groupId === group.id),
      });
      const balance = balances.get(SELF_PERSON_ID) ?? 0;
      if (balance > 0) youAreOwedSplit += balance;
      else youOweSplit += -balance;
    }

    const ledgers = (await db.lendLedgers.toArray()).filter(
      (ledger) => !ledger.deletedAt && !ledger.archived && ledger.currency === currency,
    );
    const lendEntries = (await db.lendEntries.toArray()).filter((entry) => !entry.deletedAt);
    let youWillReceiveLend = 0;
    let youOweLend = 0;
    for (const ledger of ledgers) {
      const balance = sumLendEntries(
        lendEntries.filter((entry) => entry.ledgerId === ledger.id),
      );
      if (balance > 0) youWillReceiveLend += balance;
      else youOweLend += -balance;
    }

    return {
      month,
      personalSpending: {
        trackMinor: spentMinor,
        splitShareMinor,
        totalMinor: spentMinor + splitShareMinor,
        currency,
      },
      track: { spentMinor, incomeMinor, currency, budgetMinor, budgetRemainingMinor },
      split: { youAreOwedMinor: youAreOwedSplit, youOweMinor: youOweSplit, currency },
      lend: { youWillReceiveMinor: youWillReceiveLend, youOweMinor: youOweLend, currency },
    };
  }, [month]);
}

export function useGlobalActivity(limit = 20): ActivityItem[] | undefined {
  return useLiveQuery(async () => {
    const db = getDB();
    const [trackAll, groups, expenses, settlements, ledgers, lendEntries, people] = await Promise.all([
      db.trackTransactions.toArray(),
      db.splitGroups.toArray(),
      db.splitExpenses.toArray(),
      db.splitSettlements.toArray(),
      db.lendLedgers.toArray(),
      db.lendEntries.toArray(),
      db.people.toArray(),
    ]);
    const groupMap = new Map(groups.filter((group) => !group.deletedAt).map((group) => [group.id, group]));
    const peopleMap = new Map(people.filter((person) => !person.deletedAt).map((person) => [person.id, person]));
    const ledgerMap = new Map(
      ledgers
        .filter((ledger) => !ledger.deletedAt && !ledger.archived)
        .map((ledger) => [ledger.id, ledger]),
    );

    const items: ActivityItem[] = [];
    for (const transaction of trackAll) {
      if (transaction.deletedAt) continue;
      items.push(trackToActivity(transaction));
    }
    for (const expense of expenses) {
      if (expense.deletedAt) continue;
      const group = groupMap.get(expense.groupId);
      if (!group) continue;
      items.push(splitToActivity(expense, group.name, group.currency));
    }
    for (const settlement of settlements) {
      if (settlement.deletedAt) continue;
      const group = groupMap.get(settlement.groupId);
      if (!group) continue;
      items.push(splitSettlementToActivity(settlement, group.name));
    }
    for (const entry of lendEntries) {
      if (entry.deletedAt) continue;
      const ledger = ledgerMap.get(entry.ledgerId);
      if (!ledger) continue;
      const person = peopleMap.get(ledger.personId);
      const name = person?.name ?? 'Someone';
      const item = lendToActivity(entry, name);
      item.currency = ledger.currency as CurrencyCode;
      items.push(item);
    }
    return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, limit);
  }, [limit]);
}

export function usePersonExposure(personId: string): PersonExposure | null | undefined {
  return useLiveQuery(async () => {
    if (!personId) return null;
    const db = getDB();
    const person = await db.people.get(personId);
    if (!person || person.deletedAt) return null;
    const contexts: PersonExposure['contexts'] = [];

    const ledgers = (await db.lendLedgers.where('personId').equals(personId).toArray()).filter(
      (ledger) => !ledger.deletedAt && !ledger.archived,
    );
    const ledgerIds = new Set(ledgers.map((ledger) => ledger.id));
    const lendEntries = ledgerIds.size
      ? (await db.lendEntries.where('ledgerId').anyOf([...ledgerIds]).toArray()).filter(
          (entry) => !entry.deletedAt,
        )
      : [];
    for (const ledger of ledgers) {
      const balance = sumLendEntries(
        lendEntries.filter((entry) => entry.ledgerId === ledger.id),
      );
      contexts.push({
        module: 'lend',
        contextId: ledger.id,
        contextName: ledger.label || 'Personal lending',
        balanceMinor: balance,
        currency: ledger.currency as CurrencyCode,
      });
    }

    const allMembers = (await db.splitGroupMembers.toArray()).filter((member) => !member.deletedAt);
    const memberships = allMembers.filter((member) => member.personId === personId);
    const [groupsAll, expensesAll, payersAll, sharesAll, settlementsAll] = await Promise.all([
      db.splitGroups.toArray(),
      db.splitExpenses.toArray(),
      db.splitPayers.toArray(),
      db.splitShares.toArray(),
      db.splitSettlements.toArray(),
    ]);
    const groups = groupsAll.filter((group) => !group.deletedAt);
    const expenses = expensesAll.filter((expense) => !expense.deletedAt);
    const payers = payersAll.filter((payer) => !payer.deletedAt);
    const shares = sharesAll.filter((share) => !share.deletedAt);
    const settlements = settlementsAll.filter((settlement) => !settlement.deletedAt);

    for (const membership of memberships) {
      const group = groups.find((candidate) => candidate.id === membership.groupId);
      if (!group) continue;
      const groupExpenses = expenses.filter((expense) => expense.groupId === group.id);
      const expenseIds = new Set(groupExpenses.map((expense) => expense.id));
      const balances = computeMemberBalances({
        group,
        members: allMembers.filter((member) => member.groupId === group.id),
        expenses: groupExpenses,
        payers: payers.filter((payer) => expenseIds.has(payer.expenseId)),
        shares: shares.filter((share) => expenseIds.has(share.expenseId)),
        settlements: settlements.filter((settlement) => settlement.groupId === group.id),
      });
      contexts.push({
        module: 'split',
        contextId: group.id,
        contextName: group.name,
        balanceMinor: balances.get(personId) ?? 0,
        currency: group.currency as CurrencyCode,
      });
    }

    const currencies = new Set(contexts.map((context) => context.currency));
    const informationalNetMinor =
      currencies.size === 1
        ? contexts.reduce((sum, context) => sum + context.balanceMinor, 0)
        : undefined;

    return {
      personId,
      personName: person.name,
      contexts,
      ...(informationalNetMinor !== undefined ? { informationalNetMinor } : {}),
    };
  }, [personId]);
}
