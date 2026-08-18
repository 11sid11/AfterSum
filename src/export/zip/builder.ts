/**
 * ZIP exporter.
 *
 * Wraps `fflate` to produce a Blob containing the full
 * data package per work.md section 56.
 *
 *   README.txt
 *   manifest.json
 *   shared/people.csv
 *   track/{transactions,categories,budgets,recurring}.csv
 *   split/{groups,members,expenses,payers,shares,settlements}.csv
 *   lend/{ledgers,entries}.csv
 *   overview/{people-summary,monthly-summary}.csv
 */

import { zip, strToU8 } from 'fflate';
import { APP_VERSION, SCHEMA_VERSION } from '@app/constants';
import { getDB } from '@db/database';
import type {
  LendEntry,
  LendLedger,
  Person,
  SplitExpense,
  SplitGroup,
  SplitGroupMember,
  SplitPayer,
  SplitSettlement,
  SplitShare,
  TrackTransaction,
} from '@db/schema';
import { entryToSignedAmount } from '@modules/lend/domain/signs';
import { computeMemberBalances } from '@modules/split/domain/balances';
import { nowISO, toMonthKey } from '@shared/dates';
import { minorToDecimalString } from '@shared/money';
import {
  csvOfPeople,
  csvOfTrackTransactions,
  csvOfTrackCategories,
  csvOfTrackBudgets,
  csvOfTrackRecurring,
  csvOfSplitGroups,
  csvOfSplitMembers,
  csvOfSplitExpenses,
  csvOfSplitPayers,
  csvOfSplitShares,
  csvOfSplitSettlements,
  csvOfLendLedgers,
  csvOfLendEntries,
  csvRow,
} from '../csv/serializer';

export const README_TEXT = `AfterSum — Data Export
======================

This archive contains a snapshot of the local AfterSum database.
The format is human-readable CSV plus a manifest.

Module independence
-------------------
Track, Split, and Lend are independent financial modules.
They share only Person records (identity) and core utilities.

The Overview files in the overview/ directory are derived
summaries. They MUST NOT be imported back as financial
transactions. They are informational only.

Restoring
---------
This CSV package is for inspection and audit, not restore.
For a full restore, use the portable AfterSum backup from
Settings → Data & Storage → Portable backup.

Schema
------
format: finance-utility-csv-package
schemaVersion: ${SCHEMA_VERSION}
appVersion: ${APP_VERSION}
`;

export interface Manifest {
  format: 'finance-utility-csv-package';
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  counts: {
    people: number;
    trackTransactions: number;
    trackCategories: number;
    trackBudgets: number;
    trackRecurring: number;
    splitGroups: number;
    splitMembers: number;
    splitExpenses: number;
    splitPayers: number;
    splitShares: number;
    splitSettlements: number;
    lendLedgers: number;
    lendEntries: number;
  };
}

export interface FullZipOptions {
  includeOverview?: boolean;
}

export async function buildFullZip(opts: FullZipOptions = {}): Promise<Blob> {
  const db = getDB();
  const [
    settings,
    people,
    trackTx,
    trackCats,
    trackBudgets,
    trackRecurring,
    splitGroups,
    splitMembers,
    splitExpenses,
    splitPayers,
    splitShares,
    splitSettlements,
    lendLedgers,
    lendEntries,
  ] = await db.transaction(
    'r',
    [
      db.settings,
      db.people,
      db.trackTransactions,
      db.trackCategories,
      db.trackBudgets,
      db.trackRecurringRules,
      db.splitGroups,
      db.splitGroupMembers,
      db.splitExpenses,
      db.splitPayers,
      db.splitShares,
      db.splitSettlements,
      db.lendLedgers,
      db.lendEntries,
    ],
    async () =>
      Promise.all([
        db.settings.get('app'),
        db.people.toArray(),
        db.trackTransactions.toArray(),
        db.trackCategories.toArray(),
        db.trackBudgets.toArray(),
        db.trackRecurringRules.toArray(),
        db.splitGroups.toArray(),
        db.splitGroupMembers.toArray(),
        db.splitExpenses.toArray(),
        db.splitPayers.toArray(),
        db.splitShares.toArray(),
        db.splitSettlements.toArray(),
        db.lendLedgers.toArray(),
        db.lendEntries.toArray(),
      ]),
  );

  const defaultCurrency = settings?.defaultCurrency ?? 'INR';
  const inputs: Record<string, Uint8Array> = {
    'README.txt': strToU8(README_TEXT),
    'manifest.json': strToU8(
      JSON.stringify(
        {
          format: 'finance-utility-csv-package',
          schemaVersion: SCHEMA_VERSION,
          exportedAt: nowISO(),
          appVersion: APP_VERSION,
          counts: {
            people: people.length,
            trackTransactions: trackTx.length,
            trackCategories: trackCats.length,
            trackBudgets: trackBudgets.length,
            trackRecurring: trackRecurring.length,
            splitGroups: splitGroups.length,
            splitMembers: splitMembers.length,
            splitExpenses: splitExpenses.length,
            splitPayers: splitPayers.length,
            splitShares: splitShares.length,
            splitSettlements: splitSettlements.length,
            lendLedgers: lendLedgers.length,
            lendEntries: lendEntries.length,
          },
        } satisfies Manifest,
        null,
        2,
      ),
    ),
    'shared/people.csv': strToU8(csvOfPeople(people)),
    'track/transactions.csv': strToU8(csvOfTrackTransactions(trackTx, trackCats)),
    'track/categories.csv': strToU8(csvOfTrackCategories(trackCats)),
    'track/budgets.csv': strToU8(csvOfTrackBudgets(trackBudgets)),
    'track/recurring.csv': strToU8(csvOfTrackRecurring(trackRecurring)),
    'split/groups.csv': strToU8(csvOfSplitGroups(splitGroups)),
    'split/members.csv': strToU8(csvOfSplitMembers(splitMembers, people)),
    'split/expenses.csv': strToU8(csvOfSplitExpenses(splitExpenses, splitGroups)),
    'split/payers.csv': strToU8(csvOfSplitPayers(splitPayers, splitExpenses, people)),
    'split/shares.csv': strToU8(csvOfSplitShares(splitShares, splitExpenses, people)),
    'split/settlements.csv': strToU8(csvOfSplitSettlements(splitSettlements, splitGroups, people)),
    'lend/ledgers.csv': strToU8(csvOfLendLedgers(lendLedgers, people)),
    'lend/entries.csv': strToU8(csvOfLendEntries(lendEntries, lendLedgers, people)),
  };

  if (opts.includeOverview !== false) {
    inputs['overview/people-summary.csv'] = strToU8(
      buildPeopleSummary({
        people,
        ledgers: lendLedgers,
        lendEntries,
        groups: splitGroups,
        members: splitMembers,
        expenses: splitExpenses,
        payers: splitPayers,
        shares: splitShares,
        settlements: splitSettlements,
      }),
    );
    inputs['overview/monthly-summary.csv'] = strToU8(
      buildMonthlySummary(trackTx, defaultCurrency),
    );
  }

  const out = await new Promise<Uint8Array>((resolve, reject) => {
    zip(inputs, { level: 6 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
  return new Blob([out], { type: 'application/zip' });
}

interface PeopleSummaryInputs {
  people: Person[];
  ledgers: LendLedger[];
  lendEntries: LendEntry[];
  groups: SplitGroup[];
  members: SplitGroupMember[];
  expenses: SplitExpense[];
  payers: SplitPayer[];
  shares: SplitShare[];
  settlements: SplitSettlement[];
}

function buildPeopleSummary(inputs: PeopleSummaryInputs): string {
  const lendTotals = new Map<string, Map<string, number>>();
  const splitTotals = new Map<string, Map<string, number>>();

  const entriesByLedger = new Map<string, LendEntry[]>();
  for (const entry of inputs.lendEntries) {
    if (entry.deletedAt) continue;
    pushGrouped(entriesByLedger, entry.ledgerId, entry);
  }

  for (const ledger of inputs.ledgers) {
    if (ledger.deletedAt || ledger.archived) continue;
    const balance = (entriesByLedger.get(ledger.id) ?? []).reduce(
      (sum, entry) => sum + entryToSignedAmount(entry),
      0,
    );
    addCurrencyTotal(lendTotals, ledger.personId, ledger.currency, balance);
  }

  const membersByGroup = new Map<string, SplitGroupMember[]>();
  const expensesByGroup = new Map<string, SplitExpense[]>();
  const payersByGroup = new Map<string, SplitPayer[]>();
  const sharesByGroup = new Map<string, SplitShare[]>();
  const settlementsByGroup = new Map<string, SplitSettlement[]>();
  const groupIdByExpense = new Map<string, string>();

  for (const member of inputs.members) {
    if (!member.deletedAt) pushGrouped(membersByGroup, member.groupId, member);
  }
  for (const expense of inputs.expenses) {
    if (expense.deletedAt) continue;
    pushGrouped(expensesByGroup, expense.groupId, expense);
    groupIdByExpense.set(expense.id, expense.groupId);
  }
  for (const payer of inputs.payers) {
    if (payer.deletedAt) continue;
    const groupId = groupIdByExpense.get(payer.expenseId);
    if (groupId) pushGrouped(payersByGroup, groupId, payer);
  }
  for (const share of inputs.shares) {
    if (share.deletedAt) continue;
    const groupId = groupIdByExpense.get(share.expenseId);
    if (groupId) pushGrouped(sharesByGroup, groupId, share);
  }
  for (const settlement of inputs.settlements) {
    if (!settlement.deletedAt) pushGrouped(settlementsByGroup, settlement.groupId, settlement);
  }

  for (const group of inputs.groups) {
    if (group.deletedAt) continue;
    const balances = computeMemberBalances({
      group,
      members: membersByGroup.get(group.id) ?? [],
      expenses: expensesByGroup.get(group.id) ?? [],
      payers: payersByGroup.get(group.id) ?? [],
      shares: sharesByGroup.get(group.id) ?? [],
      settlements: settlementsByGroup.get(group.id) ?? [],
    });
    for (const [personId, balance] of balances) {
      addCurrencyTotal(splitTotals, personId, group.currency, balance);
    }
  }

  const lines = [csvRow(['person_id', 'person_name', 'lend_balances', 'split_balances'])];
  for (const person of inputs.people) {
    if (person.deletedAt) continue;
    lines.push(
      csvRow([
        person.id,
        person.name,
        formatCurrencyTotals(lendTotals.get(person.id)),
        formatCurrencyTotals(splitTotals.get(person.id)),
      ]),
    );
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function buildMonthlySummary(trackTx: TrackTransaction[], defaultCurrency: string): string {
  const byMonthCurrency = new Map<
    string,
    { month: string; spent: number; income: number; currency: string }
  >();

  for (const transaction of trackTx) {
    if (transaction.deletedAt) continue;
    const month = transaction.date.slice(0, 7);
    const key = `${month}\u0000${transaction.currency}`;
    const current = byMonthCurrency.get(key) ?? {
      month,
      spent: 0,
      income: 0,
      currency: transaction.currency,
    };
    if (transaction.type === 'expense') current.spent += transaction.amountMinor;
    else current.income += transaction.amountMinor;
    byMonthCurrency.set(key, current);
  }

  const currentMonth = toMonthKey();
  const currentKey = `${currentMonth}\u0000${defaultCurrency}`;
  if (!byMonthCurrency.has(currentKey)) {
    byMonthCurrency.set(currentKey, {
      month: currentMonth,
      spent: 0,
      income: 0,
      currency: defaultCurrency,
    });
  }

  const rows = [...byMonthCurrency.values()].sort(
    (a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency),
  );
  const lines = [csvRow(['month', 'spent', 'income', 'currency'])];
  for (const row of rows) {
    lines.push(
      csvRow([
        row.month,
        minorToDecimalString(row.spent, row.currency),
        minorToDecimalString(row.income, row.currency),
        row.currency,
      ]),
    );
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function pushGrouped<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const rows = map.get(key) ?? [];
  rows.push(value);
  map.set(key, rows);
}

function addCurrencyTotal(
  totals: Map<string, Map<string, number>>,
  personId: string,
  currency: string,
  amountMinor: number,
): void {
  const byCurrency = totals.get(personId) ?? new Map<string, number>();
  byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amountMinor);
  totals.set(personId, byCurrency);
}

function formatCurrencyTotals(totals: Map<string, number> | undefined): string {
  if (!totals) return '';
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amountMinor]) => `${currency} ${minorToDecimalString(amountMinor, currency)}`)
    .join(' | ');
}
