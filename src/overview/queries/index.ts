/**
 * Live overview queries.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import { SELF_PERSON_ID } from '@db/seed';
import { toMonthKey, isInMonth } from '@shared/dates';
import { settingsRepository } from '@shared/settings/repository';
import {
  trackToActivity,
  splitToActivity,
  splitSettlementToActivity,
  lendToActivity,
} from '../adapters';
import { calculateSplitPersonalShareForMonth } from '../projections/calculations';
import type { ActivityItem, OverviewSummary, PersonExposure } from '../projections/types';
import type { CurrencyCode } from '@shared/money';

function computeSignedLendSum(types: string[], entries: Array<{ type: string; amountMinor: number }>): number {
  let s = 0;
  for (const e of entries) {
    if (!types.includes(e.type)) continue;
    if (e.type === 'lent' || e.type === 'repayment_given' || e.type === 'adjustment') s += e.amountMinor;
    else s -= e.amountMinor;
  }
  return s;
}

export function useOverviewSummary(month: string = toMonthKey()): OverviewSummary | undefined {
  return useLiveQuery(async () => {
    const settings = await settingsRepository.get();
    const currency = settings.defaultCurrency;
    const db = getDB();
    const trackAll = await db.trackTransactions.toArray();
    const trackActive = trackAll.filter((t) => !t.deletedAt);
    const monthTrack = trackActive.filter((t) => isInMonth(t.date, month) && t.currency === currency);
    const spentMinor = monthTrack.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amountMinor, 0);
    const incomeMinor = monthTrack.filter((t) => t.type === 'income').reduce((a, b) => a + b.amountMinor, 0);
    const budget = await db.trackBudgets.get(month);
    const budgetMinor = budget && budget.currency === currency ? budget.amountMinor : undefined;
    const budgetRemainingMinor = budgetMinor !== undefined ? budgetMinor - spentMinor : undefined;

    const groups = (await db.splitGroups.toArray()).filter((g) => !g.deletedAt);
    const expenses = (await db.splitExpenses.toArray()).filter((e) => !e.deletedAt);
    const payers = (await db.splitPayers.toArray()).filter((p) => !p.deletedAt);
    const shares = (await db.splitShares.toArray()).filter((s) => !s.deletedAt);
    const settlements = (await db.splitSettlements.toArray()).filter((s) => !s.deletedAt);
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
    for (const g of groups) {
      if (g.currency !== currency) continue;
      const gExp = expenses.filter((e) => e.groupId === g.id);
      const expenseIds = new Set(gExp.map((e) => e.id));
      const gPay = payers.filter((p) => expenseIds.has(p.expenseId));
      const gSha = shares.filter((s) => expenseIds.has(s.expenseId));
      const gSet = settlements.filter((s) => s.groupId === g.id);
      const myPaid = gPay.filter((p) => p.personId === SELF_PERSON_ID).reduce((a, b) => a + b.amountMinor, 0);
      const myShare = gSha.filter((s) => s.personId === SELF_PERSON_ID).reduce((a, b) => a + b.amountMinor, 0);
      const mySent = gSet.filter((s) => s.fromPersonId === SELF_PERSON_ID).reduce((a, b) => a + b.amountMinor, 0);
      const myReceived = gSet.filter((s) => s.toPersonId === SELF_PERSON_ID).reduce((a, b) => a + b.amountMinor, 0);
      const bal = myPaid - myShare + mySent - myReceived;
      if (bal > 0) youAreOwedSplit += bal;
      else youOweSplit += -bal;
    }

    const ledgers = (await db.lendLedgers.toArray()).filter((l) => !l.deletedAt && l.currency === currency);
    const lendEntries = (await db.lendEntries.toArray()).filter((e) => !e.deletedAt);
    let youWillReceiveLend = 0;
    let youOweLend = 0;
    for (const l of ledgers) {
      const e = lendEntries.filter((x) => x.ledgerId === l.id);
      const sum = computeSignedLendSum(['lent', 'borrowed', 'repayment_received', 'repayment_given', 'adjustment'], e);
      if (sum > 0) youWillReceiveLend += sum;
      else youOweLend += -sum;
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
    const groupMap = new Map(groups.filter((g) => !g.deletedAt).map((g) => [g.id, g]));
    const peopleMap = new Map(people.filter((p) => !p.deletedAt).map((p) => [p.id, p]));
    const ledgerMap = new Map(ledgers.filter((l) => !l.deletedAt).map((l) => [l.id, l]));

    const items: ActivityItem[] = [];
    for (const t of trackAll) {
      if (t.deletedAt) continue;
      items.push(trackToActivity(t));
    }
    for (const e of expenses) {
      if (e.deletedAt) continue;
      const g = groupMap.get(e.groupId);
      if (!g) continue;
      items.push(splitToActivity(e, g.name, g.currency));
    }
    for (const s of settlements) {
      if (s.deletedAt) continue;
      const g = groupMap.get(s.groupId);
      if (!g) continue;
      items.push(splitSettlementToActivity(s, g.name));
    }
    for (const entry of lendEntries) {
      if (entry.deletedAt) continue;
      const l = ledgerMap.get(entry.ledgerId);
      if (!l) continue;
      const person = peopleMap.get(l.personId);
      const name = person?.name ?? 'Someone';
      const item = lendToActivity(entry, name);
      item.currency = l.currency as CurrencyCode;
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

    const ledgers = (await db.lendLedgers.toArray()).filter((l) => !l.deletedAt && l.personId === personId);
    const lendEntries = (await db.lendEntries.toArray()).filter((e) => !e.deletedAt);
    for (const l of ledgers) {
      const e = lendEntries.filter((x) => x.ledgerId === l.id);
      const balance = computeSignedLendSum(['lent', 'borrowed', 'repayment_received', 'repayment_given', 'adjustment'], e);
      contexts.push({
        module: 'lend',
        contextId: l.id,
        contextName: l.label || 'Personal lending',
        balanceMinor: balance,
        currency: l.currency as CurrencyCode,
      });
    }

    const members = (await db.splitGroupMembers.toArray()).filter((m) => !m.deletedAt && m.personId === personId);
    const groups = (await db.splitGroups.toArray()).filter((g) => !g.deletedAt);
    const expenses = (await db.splitExpenses.toArray()).filter((e) => !e.deletedAt);
    const payers = (await db.splitPayers.toArray()).filter((p) => !p.deletedAt);
    const sShares = (await db.splitShares.toArray()).filter((s) => !s.deletedAt);
    const settlements = (await db.splitSettlements.toArray()).filter((s) => !s.deletedAt);
    for (const m of members) {
      const g = groups.find((x) => x.id === m.groupId);
      if (!g) continue;
      const gExp = expenses.filter((e) => e.groupId === g.id);
      const expenseIds = new Set(gExp.map((e) => e.id));
      const gPay = payers.filter((p) => expenseIds.has(p.expenseId));
      const gSha = sShares.filter((s) => expenseIds.has(s.expenseId));
      const gSet = settlements.filter((s) => s.groupId === g.id);
      const theirPaid = gPay.filter((p) => p.personId === personId).reduce((a, b) => a + b.amountMinor, 0);
      const theirShare = gSha.filter((s) => s.personId === personId).reduce((a, b) => a + b.amountMinor, 0);
      const theirSent = gSet.filter((s) => s.fromPersonId === personId).reduce((a, b) => a + b.amountMinor, 0);
      const theirReceived = gSet.filter((s) => s.toPersonId === personId).reduce((a, b) => a + b.amountMinor, 0);
      const theirBalance = theirPaid - theirShare + theirSent - theirReceived;
      contexts.push({
        module: 'split',
        contextId: g.id,
        contextName: g.name,
        balanceMinor: theirBalance,
        currency: g.currency as CurrencyCode,
      });
    }

    const currencies = new Set(contexts.map((c) => c.currency));
    let informationalNetMinor: number | undefined;
    if (currencies.size === 1) {
      informationalNetMinor = contexts.reduce((a, c) => a + c.balanceMinor, 0);
    }
    return {
      personId,
      personName: person.name,
      contexts,
      ...(informationalNetMinor !== undefined ? { informationalNetMinor } : {}),
    };
  }, [personId]);
}
