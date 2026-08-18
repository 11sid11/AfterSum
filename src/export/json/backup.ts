/**
 * JSON backup format.
 *
 * Restoreable backups contain financial identity/settings plus every
 * Track, Split, and Lend record. Restore replaces financial data inside
 * one atomic database transaction while preserving device-only UI settings.
 */

import { z } from 'zod';
import { getDB } from '@db/database';
import { APP_VERSION } from '@app/constants';
import { nowISO } from '@shared/dates';
import { settingsRepository } from '@shared/settings/repository';
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
export const BACKUP_SCHEMA_VERSION = 2;

const idSchema = z.string().min(1);
const currencySchema = z.string().trim().min(1);
const minorAmountSchema = z.number().int().nonnegative();
const baseEntitySchema = z.object({
  id: idSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  revision: z.number().int().nonnegative(),
});

const personSchema = baseEntitySchema.extend({
  name: z.string(),
  isSelf: z.boolean().optional(),
}).passthrough();

const trackTransactionSchema = baseEntitySchema.extend({
  type: z.enum(['expense', 'income']),
  title: z.string(),
  amountMinor: minorAmountSchema,
  currency: currencySchema,
  date: z.string(),
}).passthrough();

const trackCategorySchema = baseEntitySchema.extend({
  name: z.string(),
  type: z.enum(['expense', 'income']),
  archived: z.boolean(),
}).passthrough();

const trackBudgetSchema = baseEntitySchema.extend({
  month: z.string(),
  amountMinor: minorAmountSchema,
  currency: currencySchema,
}).passthrough();

const trackRecurringRuleSchema = baseEntitySchema.extend({
  title: z.string(),
  amountMinor: minorAmountSchema.optional(),
  currency: currencySchema,
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  nextDate: z.string(),
  enabled: z.boolean(),
}).passthrough();

const splitGroupSchema = baseEntitySchema.extend({
  name: z.string(),
  currency: currencySchema,
  archived: z.boolean(),
}).passthrough();

const splitGroupMemberSchema = baseEntitySchema.extend({
  groupId: idSchema,
  personId: idSchema,
  active: z.boolean(),
  joinedAt: z.string(),
}).passthrough();

const splitExpenseSchema = baseEntitySchema.extend({
  groupId: idSchema,
  title: z.string(),
  amountMinor: minorAmountSchema,
  currency: currencySchema,
  date: z.string(),
  splitMethod: z.enum(['equal', 'exact', 'percentage', 'shares']),
}).passthrough();

const splitPayerSchema = baseEntitySchema.extend({
  expenseId: idSchema,
  personId: idSchema,
  amountMinor: minorAmountSchema,
}).passthrough();

const splitShareSchema = baseEntitySchema.extend({
  expenseId: idSchema,
  personId: idSchema,
  amountMinor: minorAmountSchema,
}).passthrough();

const splitSettlementSchema = baseEntitySchema.extend({
  groupId: idSchema,
  fromPersonId: idSchema,
  toPersonId: idSchema,
  amountMinor: minorAmountSchema,
  currency: currencySchema,
  date: z.string(),
}).passthrough();

const lendLedgerSchema = baseEntitySchema.extend({
  personId: idSchema,
  currency: currencySchema,
  archived: z.boolean(),
}).passthrough();

const lendEntrySchema = baseEntitySchema.extend({
  ledgerId: idSchema,
  type: z.enum(['lent', 'borrowed', 'repayment_received', 'repayment_given', 'adjustment']),
  amountMinor: z.number().int(),
  date: z.string(),
}).passthrough();

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string().min(1),
  appVersion: z.string().min(1),
  shared: z.object({
    people: z.array(personSchema),
    settings: z.object({
      defaultCurrency: currencySchema,
    }).strict(),
  }).strict(),
  track: z.object({
    transactions: z.array(trackTransactionSchema),
    categories: z.array(trackCategorySchema),
    budgets: z.array(trackBudgetSchema),
    recurringRules: z.array(trackRecurringRuleSchema),
  }).strict(),
  split: z.object({
    groups: z.array(splitGroupSchema),
    members: z.array(splitGroupMemberSchema),
    expenses: z.array(splitExpenseSchema),
    payers: z.array(splitPayerSchema),
    shares: z.array(splitShareSchema),
    settlements: z.array(splitSettlementSchema),
  }).strict(),
  lend: z.object({
    ledgers: z.array(lendLedgerSchema),
    entries: z.array(lendEntrySchema),
  }).strict(),
}).strict();

export interface BackupSettings {
  defaultCurrency: string;
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  appVersion: string;
  shared: {
    people: Person[];
    settings: BackupSettings;
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

/** Build one transactionally-consistent snapshot of the local financial database. */
export async function exportBackup(): Promise<Backup> {
  const db = getDB();

  // Ensure first-run defaults exist before opening the read-only snapshot.
  await settingsRepository.get();

  const [
    settings,
    people,
    transactions,
    categories,
    budgets,
    recurringRules,
    groups,
    members,
    expenses,
    payers,
    shares,
    settlements,
    ledgers,
    entries,
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

  if (!settings) {
    throw new Error('App settings are unavailable, so a complete backup cannot be created.');
  }

  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: nowISO(),
    appVersion: APP_VERSION,
    shared: {
      people,
      settings: { defaultCurrency: settings.defaultCurrency },
    },
    track: { transactions, categories, budgets, recurringRules },
    split: { groups, members, expenses, payers, shares, settlements },
    lend: { ledgers, entries },
  };
}

/** Validate a parsed backup object. Throws with the first invalid path. */
export function validateBackup(input: unknown): Backup {
  const result = backupSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.');
    throw new Error(`Invalid backup${path ? ` at ${path}` : ''}: ${issue?.message ?? 'unknown validation error'}`);
  }
  return result.data as Backup;
}

/** Restore a backup into the local database atomically. */
export async function restoreBackup(backup: Backup): Promise<void> {
  const db = getDB();
  const currentSettings = await settingsRepository.get();
  const restoredSettings = {
    ...currentSettings,
    defaultCurrency: backup.shared.settings.defaultCurrency,
    updatedAt: nowISO(),
    revision: currentSettings.revision + 1,
  };

  await db.transaction(
    'rw',
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
    async () => {
      await Promise.all([
        db.settings.clear(),
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

      await db.settings.put(restoredSettings);
      if (backup.shared.people.length > 0) await db.people.bulkPut(backup.shared.people);
      if (backup.track.transactions.length > 0) await db.trackTransactions.bulkPut(backup.track.transactions);
      if (backup.track.categories.length > 0) await db.trackCategories.bulkPut(backup.track.categories);
      if (backup.track.budgets.length > 0) await db.trackBudgets.bulkPut(backup.track.budgets);
      if (backup.track.recurringRules.length > 0) await db.trackRecurringRules.bulkPut(backup.track.recurringRules);
      if (backup.split.groups.length > 0) await db.splitGroups.bulkPut(backup.split.groups);
      if (backup.split.members.length > 0) await db.splitGroupMembers.bulkPut(backup.split.members);
      if (backup.split.expenses.length > 0) await db.splitExpenses.bulkPut(backup.split.expenses);
      if (backup.split.payers.length > 0) await db.splitPayers.bulkPut(backup.split.payers);
      if (backup.split.shares.length > 0) await db.splitShares.bulkPut(backup.split.shares);
      if (backup.split.settlements.length > 0) await db.splitSettlements.bulkPut(backup.split.settlements);
      if (backup.lend.ledgers.length > 0) await db.lendLedgers.bulkPut(backup.lend.ledgers);
      if (backup.lend.entries.length > 0) await db.lendEntries.bulkPut(backup.lend.entries);
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
