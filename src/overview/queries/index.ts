/** Live overview queries. */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import { SELF_PERSON_ID } from '@db/seed';
import { monthDateRange, toMonthKey } from '@shared/dates';
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
import type {
  LendEntry,
  SplitExpense,
  SplitGroup,
  SplitGroupMember,
  SplitPayer,
  SplitSettlement,
  SplitShare,
} from '@db/schema';

function sumLendEntries(entries: Array<Pick<LendEntry, 'type' | 'amountMinor'>>): number {
  return entries.reduce((sum, entry) => sum + entryToSignedAmount(entry), 0);
}

function pushGrouped<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const rows = map.get(key) ?? [];
  rows.push(value);
  map.set(key, rows);
}

export function useOverviewSummary(month: string = toMonthKey()): OverviewSummary | undefined {
  return useLiveQuery(async () => {
    const settings = await settingsRepository.get();
    const currency = settings.defaultCurrency;
    const db = getDB();
    const { fromInclusive, toExclusive } = monthDateRange(month);

    const [trackMonthRows, budget] = await Promise.all([
      db.trackTransactions.where('date').between(fromInclusive, toExclusive, true, false).toArray(),
      trackBudgetRepository.getByMonth(month),
    ]);
    const monthTrack = trackMonthRows.filter(
      (transaction) => !transaction.deletedAt && transaction.currency === currency,
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

    const membersByGroup = new Map<string, SplitGroupMember[]>();
    const expensesByGroup = new Map<string, SplitExpense[]>();
    const payersByGroup = new Map<string, SplitPayer[]>();
    const sharesByGroup = new Map<string, SplitShare[]>();
    const settlementsByGroup = new Map<string, SplitSettlement[]>();
    const groupIdByExpense = new Map<string, string>();

    for (const member of members) pushGrouped(membersByGroup, member.groupId, member);
    for (const expense of expenses) {
      pushGrouped(expensesByGroup, expense.groupId, expense);
      groupIdByExpense.set(expense.id, expense.groupId);
    }
    for (const payer of payers) {
      const groupId = groupIdByExpense.get(payer.expenseId);
      if (groupId) pushGrouped(payersByGroup, groupId, payer);
    }
    for (const share of shares) {
      const groupId = groupIdByExpense.get(share.expenseId);
      if (groupId) pushGrouped(sharesByGroup, groupId, share);
    }
    for (const settlement of settlements) {
      pushGrouped(settlementsByGroup, settlement.groupId, settlement);
    }

    let youAreOwedSplit = 0;
    let youOweSplit = 0;
    for (const group of groups) {
      if (group.currency !== currency) continue;
      const balances = computeMemberBalances({
        group,
        members: membersByGroup.get(group.id) ?? [],
        expenses: expensesByGroup.get(group.id) ?? [],
        payers: payersByGroup.get(group.id) ?? [],
        shares: sharesByGroup.get(group.id) ?? [],
        settlements: settlementsByGroup.get(group.id) ?? [],
      });
      const balance = balances.get(SELF_PERSON_ID) ?? 0;
      if (balance > 0) youAreOwedSplit += balance;
      else youOweSplit += -balance;
    }

    const ledgers = (await db.lendLedgers.toArray()).filter(
      (ledger) => !ledger.deletedAt && !ledger.archived && ledger.currency === currency,
    );
    const lendEntries = (await db.lendEntries.toArray()).filter((entry) => !entry.deletedAt);
    const lendEntriesByLedger = new Map<string, LendEntry[]>();
    for (const entry of lendEntries) pushGrouped(lendEntriesByLedger, entry.ledgerId, entry);

    let youWillReceiveLend = 0;
    let youOweLend = 0;
    for (const ledger of ledgers) {
      const balance = sumLendEntries(lendEntriesByLedger.get(ledger.id) ?? []);
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
    const ledgerIds = ledgers.map((ledger) => ledger.id);
    const lendEntries = ledgerIds.length
      ? (await db.lendEntries.where('ledgerId').anyOf(ledgerIds).toArray()).filter(
          (entry) => !entry.deletedAt,
        )
      : [];
    const lendEntriesByLedger = new Map<string, LendEntry[]>();
    for (const entry of lendEntries) pushGrouped(lendEntriesByLedger, entry.ledgerId, entry);

    for (const ledger of ledgers) {
      const balance = sumLendEntries(lendEntriesByLedger.get(ledger.id) ?? []);
      contexts.push({
        module: 'lend',
        contextId: ledger.id,
        contextName: ledger.label || 'Personal lending',
        balanceMinor: balance,
        currency: ledger.currency as CurrencyCode,
      });
    }

    const memberships = (
      await db.splitGroupMembers.where('personId').equals(personId).toArray()
    ).filter((member) => !member.deletedAt);
    const groupIds = [...new Set(memberships.map((membership) => membership.groupId))];

    if (groupIds.length > 0) {
      const [groupRows, allMembers, expenses, settlements] = await Promise.all([
        db.splitGroups.bulkGet(groupIds),
        db.splitGroupMembers.where('groupId').anyOf(groupIds).toArray(),
        db.splitExpenses.where('groupId').anyOf(groupIds).toArray(),
        db.splitSettlements.where('groupId').anyOf(groupIds).toArray(),
      ]);
      const groups = groupRows.filter(
        (group): group is SplitGroup => group !== undefined && !group.deletedAt,
      );
      const activeMembers = allMembers.filter((member) => !member.deletedAt);
      const activeExpenses = expenses.filter((expense) => !expense.deletedAt);
      const activeSettlements = settlements.filter((settlement) => !settlement.deletedAt);
      const expenseIds = activeExpenses.map((expense) => expense.id);
      const [payers, shares] = expenseIds.length
        ? await Promise.all([
            db.splitPayers.where('expenseId').anyOf(expenseIds).toArray(),
            db.splitShares.where('expenseId').anyOf(expenseIds).toArray(),
          ])
        : [[], []];

      const membersByGroup = new Map<string, SplitGroupMember[]>();
      const expensesByGroup = new Map<string, SplitExpense[]>();
      const payersByGroup = new Map<string, SplitPayer[]>();
      const sharesByGroup = new Map<string, SplitShare[]>();
      const settlementsByGroup = new Map<string, SplitSettlement[]>();
      const groupIdByExpense = new Map<string, string>();

      for (const member of activeMembers) pushGrouped(membersByGroup, member.groupId, member);
      for (const expense of activeExpenses) {
        pushGrouped(expensesByGroup, expense.groupId, expense);
        groupIdByExpense.set(expense.id, expense.groupId);
      }
      for (const payer of payers) {
        if (payer.deletedAt) continue;
        const groupId = groupIdByExpense.get(payer.expenseId);
        if (groupId) pushGrouped(payersByGroup, groupId, payer);
      }
      for (const share of shares) {
        if (share.deletedAt) continue;
        const groupId = groupIdByExpense.get(share.expenseId);
        if (groupId) pushGrouped(sharesByGroup, groupId, share);
      }
      for (const settlement of activeSettlements) {
        pushGrouped(settlementsByGroup, settlement.groupId, settlement);
      }

      for (const group of groups) {
        const balances = computeMemberBalances({
          group,
          members: membersByGroup.get(group.id) ?? [],
          expenses: expensesByGroup.get(group.id) ?? [],
          payers: payersByGroup.get(group.id) ?? [],
          shares: sharesByGroup.get(group.id) ?? [],
          settlements: settlementsByGroup.get(group.id) ?? [],
        });
        contexts.push({
          module: 'split',
          contextId: group.id,
          contextName: group.name,
          balanceMinor: balances.get(personId) ?? 0,
          currency: group.currency as CurrencyCode,
        });
      }
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
