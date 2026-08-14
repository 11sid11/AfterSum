/**
 * JSON backup format (work.md section 54).
 *
 * { format, schemaVersion, exportedAt, shared, track, split, lend }
 *
 * This is the EXACT restore format. Restore replaces all
 * data inside an atomic DB transaction.
 */

import { getDB } from '@db/database';
import { APP_VERSION, SCHEMA_VERSION } from '@app/constants';
import { nowISO } from '@shared/dates';
import type {
  Person,
  TrackTransaction,
  TrackCategory,
  TrackBudget,
  TrackRecurringRule,
  SplitGroup,
  SplitGroupMember,
  SplitExpense,
  SplitPayer,
  SplitShare,
  SplitSettlement,
  LendLedger,
  LendEntry,
} from '@db/schema';

export const BACKUP_FORMAT = 'finance-utility-backup';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  shared: {
    people: Person[];
  };
  track: {
    transactions: TrackTransaction[];
    categories: TrackCategory[];
    budgets: TrackBudget[];
    recurringRules: TrackRecurringRule[];
  };
  split: {
    groups: SplitGroup[];
    members: SplitGroupMember[];
    expenses: SplitExpense[];
    payers: SplitPayer[];
    shares: SplitShare[];
    settlements: SplitSettlement[];
  };
  lend: {
    ledgers: LendLedger[];
    entries: LendEntry[];
  };
}

/** Build a deep snapshot of the local database. */
export async function exportBackup(): Promise<Backup> {
  const db = getDB();
  const [people, track, split, lend] = await Promise.all([
    db.people.toArray(),
    db.trackTransactions.toArray().then(async (transactions) => ({
      transactions,
      categories: await db.trackCategories.toArray(),
      budgets: await db.trackBudgets.toArray(),
      recurringRules: await db.trackRecurringRules.toArray(),
    })),
    db.splitGroups.toArray().then(async (groups) => ({
      groups,
      members: await db.splitGroupMembers.toArray(),
      expenses: await db.splitExpenses.toArray(),
      payers: await db.splitPayers.toArray(),
      shares: await db.splitShares.toArray(),
      settlements: await db.splitSettlements.toArray(),
    })),
    db.lendLedgers.toArray().then(async (ledgers) => ({
      ledgers,
      entries: await db.lendEntries.toArray(),
    })),
  ]);
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowISO(),
    appVersion: APP_VERSION,
    shared: { people },
    track,
    split,
    lend,
  };
}

/** Validate a parsed backup object. Throws on shape errors. */
export function validateBackup(input: unknown): Backup {
  if (!input || typeof input !== 'object') throw new Error('Backup is not an object');
  const b = input as Partial<Backup>;
  if (b.format !== BACKUP_FORMAT) {
    throw new Error(`Invalid backup format: ${b.format}`);
  }
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version: ${b.schemaVersion}. Expected ${SCHEMA_VERSION}.`,
    );
  }
  for (const path of [
    ['shared', 'people'],
    ['track', 'transactions'],
    ['track', 'categories'],
    ['track', 'budgets'],
    ['track', 'recurringRules'],
    ['split', 'groups'],
    ['split', 'members'],
    ['split', 'expenses'],
    ['split', 'payers'],
    ['split', 'shares'],
    ['split', 'settlements'],
    ['lend', 'ledgers'],
    ['lend', 'entries'],
  ]) {
    let cur: unknown = b;
    for (const k of path) {
      if (!cur || typeof cur !== 'object' || !(k in (cur as object))) {
        throw new Error(`Backup missing ${path.join('.')}`);
      }
      cur = (cur as Record<string, unknown>)[k];
    }
    if (!Array.isArray(cur)) {
      throw new Error(`Backup ${path.join('.')} is not an array`);
    }
  }
  return b as Backup;
}

/** Restore a backup into the local database atomically. */
export async function restoreBackup(backup: Backup): Promise<void> {
  const db = getDB();
  await db.transaction(
    'rw',
    [
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
    async () => {
      await Promise.all([
        db.people.clear(),
        db.trackTransactions.clear(),
        db.trackCategories.clear(),
        db.trackBudgets.clear(),
        db.trackRecurringRules.clear(),
        db.splitGroups.clear(),
        db.splitGroupMembers.clear(),
        db.splitExpenses.clear(),
        db.splitPayers.clear(),
        db.splitShares.clear(),
        db.splitSettlements.clear(),
        db.lendLedgers.clear(),
        db.lendEntries.clear(),
      ]);
      if (backup.shared.people.length)
        await db.people.bulkPut(backup.shared.people);
      await db.trackTransactions.bulkPut(backup.track.transactions);
      await db.trackCategories.bulkPut(backup.track.categories);
      await db.trackBudgets.bulkPut(backup.track.budgets);
      await db.trackRecurringRules.bulkPut(backup.track.recurringRules);
      await db.splitGroups.bulkPut(backup.split.groups);
      await db.splitGroupMembers.bulkPut(backup.split.members);
      await db.splitExpenses.bulkPut(backup.split.expenses);
      await db.splitPayers.bulkPut(backup.split.payers);
      await db.splitShares.bulkPut(backup.split.shares);
      await db.splitSettlements.bulkPut(backup.split.settlements);
      await db.lendLedgers.bulkPut(backup.lend.ledgers);
      await db.lendEntries.bulkPut(backup.lend.entries);
    },
  );
}

/** Compute a summary of what the backup contains. */
export function summarizeBackup(b: Backup) {
  return {
    people: b.shared.people.length,
    trackTransactions: b.track.transactions.length,
    trackCategories: b.track.categories.length,
    trackBudgets: b.track.budgets.length,
    trackRecurring: b.track.recurringRules.length,
    splitGroups: b.split.groups.length,
    splitMembers: b.split.members.length,
    splitExpenses: b.split.expenses.length,
    splitSettlements: b.split.settlements.length,
    lendLedgers: b.lend.ledgers.length,
    lendEntries: b.lend.entries.length,
  };
}
