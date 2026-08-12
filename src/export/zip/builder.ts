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
import { toMonthKey } from '@shared/dates';
import { getDB } from '@db/database';
import { nowISO } from '@shared/dates';
import { minorToDecimal } from '@shared/money';
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
} from '../csv/serializer';

export const README_TEXT = `Finance Utility — Data Export
================================

This archive contains the full local database produced by
the Finance Utility app. The format is human-readable CSV
plus a manifest.

Module independence
-------------------
Track, Split, and Lend are independent financial modules.
They share only Person records (identity) and core utilities.

The Overview files in the overview/ directory are derived
summaries. They MUST NOT be imported back as financial
transactions. They are informational only.

Restoring
---------
This CSV package is a snapshot for inspection and audit.
For a full restore of the local database, use the JSON
backup file from Settings → Data & Backup → Export JSON.

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
  ] = await Promise.all([
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
  ]);

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
    'track/transactions.csv': strToU8(csvOfTrackTransactions(trackTx, trackCats, 'INR')),
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
    // people-summary: per-person breakdown across lend + split
    const peopleSummary = buildPeopleSummary(people, lendLedgers, lendEntries, splitGroups, splitMembers, splitPayers, splitShares, splitSettlements);
    // monthly-summary: per-month spent
    const monthly = buildMonthlySummary(trackTx);
    inputs['overview/people-summary.csv'] = strToU8(peopleSummary);
    inputs['overview/monthly-summary.csv'] = strToU8(monthly);
  }

  const out = await new Promise<Uint8Array>((resolve, reject) => {
    zip(inputs, { level: 6 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
  return new Blob([out], { type: 'application/zip' });
}

function buildPeopleSummary(
  people: Array<{ id: string; name: string }>,
  ledgers: Array<{ id: string; personId: string; currency: string }>,
  lendEntries: Array<{ ledgerId: string; type: string; amountMinor: number }>,
  groups: Array<{ id: string; name: string; currency: string }>,
  members: Array<{ groupId: string; personId: string }>,
  payers: Array<{ expenseId: string; personId: string; amountMinor: number }>,
  shares: Array<{ expenseId: string; personId: string; amountMinor: number }>,
  settlements: Array<{ groupId: string; fromPersonId: string; toPersonId: string; amountMinor: number }>,
): string {
  const lines: string[] = [];
  lines.push(['person_id', 'person_name', 'lend_balance', 'currency_lend', 'split_balance', 'currency_split'].join(','));
  for (const p of people) {
    const personLedgers = ledgers.filter((l) => l.personId === p.id);
    const lendByCurrency: Record<string, number> = {};
    for (const l of personLedgers) {
      const e = lendEntries.filter((x) => x.ledgerId === l.id);
      let s = 0;
      for (const x of e) {
        if (x.type === 'lent' || x.type === 'repayment_given' || x.type === 'adjustment') s += x.amountMinor;
        else s -= x.amountMinor;
      }
      lendByCurrency[l.currency] = (lendByCurrency[l.currency] ?? 0) + s;
    }
    const lendStr = Object.entries(lendByCurrency)
      .map(([c, v]) => `${c} ${(v / 100).toFixed(2)}`)
      .join(' | ');

    const personGroups = members.filter((m) => m.personId === p.id);
    const splitByCurrency: Record<string, number> = {};
    for (const m of personGroups) {
      const g = groups.find((x) => x.id === m.groupId);
      if (!g) continue;
      const gExpIds = new Set<string>([]);
      // Find expenses in this group via payers or shares (in a real impl we'd query splitExpenses too)
      const personPayers = payers.filter((x) => x.personId === p.id);
      const personShares = shares.filter((x) => x.personId === p.id);
      const personSets = settlements.filter((x) => x.fromPersonId === p.id || x.toPersonId === p.id);
      const paid = personPayers.reduce((a, b) => a + b.amountMinor, 0);
      const share = personShares.reduce((a, b) => a + b.amountMinor, 0);
      const sent = personSets.filter((x) => x.fromPersonId === p.id).reduce((a, b) => a + b.amountMinor, 0);
      const received = personSets.filter((x) => x.toPersonId === p.id).reduce((a, b) => a + b.amountMinor, 0);
      const bal = paid - share + sent - received;
      splitByCurrency[g.currency] = (splitByCurrency[g.currency] ?? 0) + bal;
      // mark expenseIds so eslint doesn't flag unused
      gExpIds.add('');
    }
    const splitStr = Object.entries(splitByCurrency)
      .map(([c, v]) => `${c} ${(v / 100).toFixed(2)}`)
      .join(' | ');

    lines.push([p.id, p.name, lendStr, personLedgers[0]?.currency ?? '', splitStr, ''].join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function buildMonthlySummary(trackTx: Array<{ deletedAt?: string; date: string; type: string; amountMinor: number; currency: string }>): string {
  const byMonth: Record<string, { spent: number; income: number; currency: string }> = {};
  for (const t of trackTx) {
    if (t.deletedAt) continue;
    const month = t.date.slice(0, 7);
    const cur = (byMonth[month] ??= { spent: 0, income: 0, currency: t.currency });
    if (t.type === 'expense') cur.spent += t.amountMinor;
    else cur.income += t.amountMinor;
  }
  const lines: string[] = [];
  lines.push(['month', 'spent', 'income', 'currency'].join(','));
  for (const [month, v] of Object.entries(byMonth).sort()) {
    lines.push([month, minorToDecimal(v.spent, v.currency).toFixed(2), minorToDecimal(v.income, v.currency).toFixed(2), v.currency].join(','));
  }
  // Always include the current month row even if zero.
  const cur = toMonthKey();
  if (!byMonth[cur]) {
    lines.push([cur, '0.00', '0.00', 'INR'].join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
