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

function activeRows<T extends { deletedAt?: string }>(rows: T[]): T[] {
  return rows.filter((row) => !row.deletedAt);
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

  // The CSV package is an analysis/export view, not a restore format. Export
  // only rows that are active in normal app behavior, and keep child tables
  // scoped to active parents so the package never contains dangling rows.
  const exportPeople = activeRows(people);
  const exportTrackTx = activeRows(trackTx);
  const exportTrackCats = activeRows(trackCats);
  const exportTrackBudgets = activeRows(trackBudgets);
  const exportTrackRecurring = activeRows(trackRecurring);
  const exportSplitGroups = activeRows(splitGroups);
  const activeGroupIds = new Set(exportSplitGroups.map((group) => group.id));
  const exportSplitMembers = activeRows(splitMembers).filter((member) => activeGroupIds.has(member.groupId));
  const exportSplitExpenses = activeRows(splitExpenses).filter((expense) => activeGroupIds.has(expense.groupId));
  const activeExpenseIds = new Set(exportSplitExpenses.map((expense) => expense.id));
  const exportSplitPayers = activeRows(splitPayers).filter((payer) => activeExpenseIds.has(payer.expenseId));
  const exportSplitShares = activeRows(splitShares).filter((share) => activeExpenseIds.has(share.expenseId));
  const exportSplitSettlements = activeRows(splitSettlements).filter((settlement) => activeGroupIds.has(settlement.groupId));
  const exportLendLedgers = activeRows(lendLedgers);
  const activeLedgerIds = new Set(exportLendLedgers.map((ledger) => ledger.id));
  const exportLendEntries = activeRows(lendEntries).filter((entry) => activeLedgerIds.has(entry.ledgerId));

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
            people: exportPeople.length,
            trackTransactions: exportTrackTx.length,
            trackCategories: exportTrackCats.length,
            trackBudgets: exportTrackBudgets.length,
            trackRecurring: exportTrackRecurring.length,
            splitGroups: exportSplitGroups.length,
            splitMembers: exportSplitMembers.length,
            splitExpenses: exportSplitExpenses.length,
            splitPayers: exportSplitPayers.length,
            splitShares: exportSplitShares.length,
            splitSettlements: exportSplitSettlements.length,
            lendLedgers: exportLendLedgers.length,
            lendEntries: exportLendEntries.length,
          },
        } satisfies Manifest,
        null,
        2,
      ),
    ),
    'shared/people.csv': strToU8(csvOfPeople(exportPeople)),
    'track/transactions.csv': strToU8(csvOfTrackTransactions(exportTrackTx, exportTrackCats)),
    'track/categories.csv': strToU8(csvOfTrackCategories(exportTrackCats)),
    'track/budgets.csv': strToU8(csvOfTrackBudgets(exportTrackBudgets)),
    'track/recurring.csv': strToU8(csvOfTrackRecurring(exportTrackRecurring)),
    'split/groups.csv': strToU8(csvOfSplitGroups(exportSplitGroups)),
    'split/members.csv': strToU8(csvOfSplitMembers(exportSplitMembers, exportPeople)),
    'split/expenses.csv': strToU8(csvOfSplitExpenses(exportSplitExpenses, exportSplitGroups)),
    'split/payers.csv': strToU8(csvOfSplitPayers(exportSplitPayers, exportSplitExpenses, exportPeople)),
    'split/shares.csv': strToU8(csvOfSplitShares(exportSplitShares, exportSplitExpenses, exportPeople)),
    'split/settlements.csv': strToU8(csvOfSplitSettlements(exportSplitSettlements, exportSplitGroups, exportPeople)),
    'lend/ledgers.csv': strToU8(csvOfLendLedgers(exportLendLedgers, exportPeople)),
    'lend/entries.csv': strToU8(csvOfLendEntries(exportLendEntries, exportLendLedgers, exportPeople)),
  };

  if (opts.includeOverview !== false) {
    inputs['overview/people-summary.csv'] = strToU8(
      buildPeopleSummary({
        people: exportPeople,
        ledgers: exportLendLedgers,
        lendEntries: exportLendEntries,
        groups: exportSplitGroups,
        members: exportSplitMembers,
        expenses: exportSplitExpenses,
        payers: exportSplitPayers,
        shares: exportSplitShares,
        settlements: exportSplitSettlements,
      }),
    );
    inputs['overview/monthly-summary.csv'] = strToU8(
      buildMonthlySummary(exportTrackTx, defaultCurrency),
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
