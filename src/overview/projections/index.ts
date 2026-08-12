/**
 * Overview pure projection functions.
 *
 * These read directly from Dexie and return derived models.
 * They do NOT persist anything. They MUST NOT mutate any
 * module's tables.
 */

import { getDB } from '@db/database';
import { SELF_PERSON_ID } from '@db/seed';
import { isInMonth } from '@shared/dates';
import { settingsRepository } from '@shared/settings/repository';
import type {
  PersonExposure,
  OverviewSummary,
} from './types';

export async function getOverviewMonth(month: string): Promise<OverviewSummary> {
  const settings = await settingsRepository.get();
  const currency = settings.defaultCurrency;
  const db = getDB();

  // Track
  const trackAll = await db.trackTransactions.toArray();
  const trackActive = trackAll.filter((t) => !t.deletedAt);
  const monthTrack = trackActive.filter((t) => isInMonth(t.date, month) && t.currency === currency);
  const spentMinor = monthTrack
    .filter((t) => t.type === 'expense')
    .reduce((a, b) => a + b.amountMinor, 0);
  const incomeMinor = monthTrack
    .filter((t) => t.type === 'income')
    .reduce((a, b) => a + b.amountMinor, 0);
  const budget = await db.trackBudgets.get(month);
  const budgetMinor = budget && budget.currency === currency ? budget.amountMinor : undefined;
  const budgetRemainingMinor = budgetMinor !== undefined ? budgetMinor - spentMinor : undefined;

  // Split
  const groups = (await db.splitGroups.toArray()).filter((g) => !g.deletedAt);
  const expenses = (await db.splitExpenses.toArray()).filter((e) => !e.deletedAt);
  const payers = await db.splitPayers.toArray();
  const shares = await db.splitShares.toArray();
  const settlements = await db.splitSettlements.toArray();

  let youAreOwedSplit = 0;
  let youOweSplit = 0;
  for (const g of groups) {
    if (g.currency !== currency) continue;
    const gExpenses = expenses.filter((e) => e.groupId === g.id);
    const gPayers = payers.filter((p) => gExpenses.some((e) => e.id === p.expenseId));
    const gShares = shares.filter((s) => gExpenses.some((e) => e.id === s.expenseId));
    const gSettlements = settlements.filter((s) => s.groupId === g.id);

    const myPaid = gPayers.filter((p) => p.personId === SELF_PERSON_ID).reduce((a, b) => a + b.amountMinor, 0);
    const myShare = gShares.filter((s) => s.personId === SELF_PERSON_ID).reduce((a, b) => a + b.amountMinor, 0);
    const mySent = gSettlements.filter((s) => s.fromPersonId === SELF_PERSON_ID).reduce((a, b) => a + b.amountMinor, 0);
    const myReceived = gSettlements.filter((s) => s.toPersonId === SELF_PERSON_ID).reduce((a, b) => a + b.amountMinor, 0);
    const myBalance = myPaid - myShare + mySent - myReceived;
    if (myBalance > 0) youAreOwedSplit += myBalance;
    else youOweSplit += -myBalance;
  }

  // Lend
  const ledgers = (await db.lendLedgers.toArray()).filter((l) => !l.deletedAt);
  const lendEntries = (await db.lendEntries.toArray()).filter((e) => !e.deletedAt);
  let youWillReceiveLend = 0;
  let youOweLend = 0;
  for (const l of ledgers) {
    if (l.currency !== currency) continue;
    const e = lendEntries.filter((x) => x.ledgerId === l.id);
    const sum = computeSignedSum(e);
    if (sum > 0) youWillReceiveLend += sum;
    else youOweLend += -sum;
  }

  return {
    month,
    track: { spentMinor, incomeMinor, currency, budgetMinor, budgetRemainingMinor },
    split: { youAreOwedMinor: youAreOwedSplit, youOweMinor: youOweSplit, currency },
    lend: { youWillReceiveMinor: youWillReceiveLend, youOweMinor: youOweLend, currency },
  };
}

function computeSignedSum(entries: Array<{ type: string; amountMinor: number }>): number {
  let s = 0;
  for (const e of entries) {
    switch (e.type) {
      case 'lent':
        s += e.amountMinor;
        break;
      case 'borrowed':
        s -= e.amountMinor;
        break;
      case 'repayment_received':
        s -= e.amountMinor;
        break;
      case 'repayment_given':
        s += e.amountMinor;
        break;
      case 'adjustment':
        s += e.amountMinor;
        break;
    }
  }
  return s;
}

export async function getPersonExposure(personId: string): Promise<PersonExposure | null> {
  const db = getDB();
  const person = await db.people.get(personId);
  if (!person || person.deletedAt) return null;

  const contexts: PersonExposure['contexts'] = [];

  // Lend ledgers for this person
  const ledgers = (await db.lendLedgers.toArray()).filter((l) => !l.deletedAt && l.personId === personId);
  const lendEntries = (await db.lendEntries.toArray()).filter((e) => !e.deletedAt);
  for (const l of ledgers) {
    const e = lendEntries.filter((x) => x.ledgerId === l.id);
    const balance = computeSignedSum(e);
    contexts.push({
      module: 'lend',
      contextId: l.id,
      contextName: l.label || 'Personal lending',
      balanceMinor: balance,
      currency: l.currency,
    });
  }

  // Split groups containing this person
  const members = (await db.splitGroupMembers.toArray()).filter((m) => m.personId === personId);
  const groups = (await db.splitGroups.toArray()).filter((g) => !g.deletedAt);
  const expenses = (await db.splitExpenses.toArray()).filter((e) => !e.deletedAt);
  const payers = await db.splitPayers.toArray();
  const shares = await db.splitShares.toArray();
  const settlements = await db.splitSettlements.toArray();

  for (const m of members) {
    const g = groups.find((x) => x.id === m.groupId);
    if (!g) continue;
    const gExpenses = expenses.filter((e) => e.groupId === g.id);
    const gPayers = payers.filter((p) => gExpenses.some((e) => e.id === p.expenseId));
    const gShares = shares.filter((s) => gExpenses.some((e) => e.id === s.expenseId));
    const gSettlements = settlements.filter((s) => s.groupId === g.id);
    const theirPaid = gPayers.filter((p) => p.personId === personId).reduce((a, b) => a + b.amountMinor, 0);
    const theirShare = gShares.filter((s) => s.personId === personId).reduce((a, b) => a + b.amountMinor, 0);
    const theirSent = gSettlements.filter((s) => s.fromPersonId === personId).reduce((a, b) => a + b.amountMinor, 0);
    const theirReceived = gSettlements.filter((s) => s.toPersonId === personId).reduce((a, b) => a + b.amountMinor, 0);
    // Sign: positive = they should receive, negative = they owe.
    // For the person exposure card, "balance" = payments - shares + sent - received
    // from THEIR perspective. We want it from their POV.
    const theirBalance = theirPaid - theirShare + theirSent - theirReceived;
    contexts.push({
      module: 'split',
      contextId: g.id,
      contextName: g.name,
      balanceMinor: theirBalance,
      currency: g.currency,
    });
  }

  // Net only when all contexts share the same currency.
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
}
