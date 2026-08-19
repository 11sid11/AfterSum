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
import { isValidDateOnly, isValidMonthKey, nowISO } from '@shared/dates';
import { personRepository } from '@shared/people/repository';
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

  // Ensure first-run identity/settings exist before opening the read-only snapshot.
  await Promise.all([settingsRepository.get(), personRepository.ensureSelf()]);

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

/** Validate a parsed backup object and its cross-table financial relationships. */
export function validateBackup(input: unknown): Backup {
  const result = backupSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.');
    throw new Error(`Invalid backup${path ? ` at ${path}` : ''}: ${issue?.message ?? 'unknown validation error'}`);
  }
  const backup = result.data as Backup;
  validateBackupRelations(backup);
  return backup;
}

function validateBackupRelations(backup: Backup): void {
  const fail = (path: string, message: string): never => {
    throw new Error(`Invalid backup at ${path}: ${message}`);
  };
  const ids = <T extends { id: string }>(path: string, rows: T[]): Set<string> => {
    const out = new Set<string>();
    for (const [index, row] of rows.entries()) {
      if (out.has(row.id)) fail(`${path}.${index}.id`, `duplicate id ${row.id}`);
      out.add(row.id);
    }
    return out;
  };
  const assertSafeAmount = (path: string, amount: number) => {
    if (!Number.isSafeInteger(amount)) fail(path, 'amount must be a safe integer');
  };

  const peopleIds = ids('shared.people', backup.shared.people);
  const categoryIds = ids('track.categories', backup.track.categories);
  ids('track.transactions', backup.track.transactions);
  ids('track.budgets', backup.track.budgets);
  ids('track.recurringRules', backup.track.recurringRules);
  const groupIds = ids('split.groups', backup.split.groups);
  ids('split.members', backup.split.members);
  const expenseIds = ids('split.expenses', backup.split.expenses);
  ids('split.payers', backup.split.payers);
  ids('split.shares', backup.split.shares);
  ids('split.settlements', backup.split.settlements);
  const ledgerIds = ids('lend.ledgers', backup.lend.ledgers);
  ids('lend.entries', backup.lend.entries);

  const activeSelf = backup.shared.people.filter((person) => person.isSelf && !person.deletedAt);
  if (activeSelf.length !== 1) {
    fail('shared.people', 'exactly one active self person is required');
  }

  for (const [index, transaction] of backup.track.transactions.entries()) {
    assertSafeAmount(`track.transactions.${index}.amountMinor`, transaction.amountMinor);
    if (!isValidDateOnly(transaction.date)) {
      fail(`track.transactions.${index}.date`, 'invalid calendar date');
    }
    if (transaction.categoryId && !categoryIds.has(transaction.categoryId)) {
      fail(`track.transactions.${index}.categoryId`, 'category does not exist');
    }
  }
  for (const [index, budget] of backup.track.budgets.entries()) {
    assertSafeAmount(`track.budgets.${index}.amountMinor`, budget.amountMinor);
    if (!isValidMonthKey(budget.month)) fail(`track.budgets.${index}.month`, 'invalid calendar month');
  }
  for (const [index, rule] of backup.track.recurringRules.entries()) {
    if (rule.amountMinor !== undefined) {
      assertSafeAmount(`track.recurringRules.${index}.amountMinor`, rule.amountMinor);
    }
    if (!isValidDateOnly(rule.nextDate)) {
      fail(`track.recurringRules.${index}.nextDate`, 'invalid calendar date');
    }
    if (rule.categoryId && !categoryIds.has(rule.categoryId)) {
      fail(`track.recurringRules.${index}.categoryId`, 'category does not exist');
    }
  }

  const groupsById = new Map(backup.split.groups.map((group) => [group.id, group]));
  for (const [index, member] of backup.split.members.entries()) {
    if (!groupIds.has(member.groupId)) fail(`split.members.${index}.groupId`, 'group does not exist');
    if (!peopleIds.has(member.personId)) fail(`split.members.${index}.personId`, 'person does not exist');
  }
  for (const [index, expense] of backup.split.expenses.entries()) {
    assertSafeAmount(`split.expenses.${index}.amountMinor`, expense.amountMinor);
    const group = groupsById.get(expense.groupId);
    if (!group) fail(`split.expenses.${index}.groupId`, 'group does not exist');
    if (expense.currency !== group.currency) {
      fail(`split.expenses.${index}.currency`, 'currency does not match its group');
    }
    if (!isValidDateOnly(expense.date)) fail(`split.expenses.${index}.date`, 'invalid calendar date');
  }
  for (const [index, payer] of backup.split.payers.entries()) {
    assertSafeAmount(`split.payers.${index}.amountMinor`, payer.amountMinor);
    if (!expenseIds.has(payer.expenseId)) fail(`split.payers.${index}.expenseId`, 'expense does not exist');
    if (!peopleIds.has(payer.personId)) fail(`split.payers.${index}.personId`, 'person does not exist');
  }
  for (const [index, share] of backup.split.shares.entries()) {
    assertSafeAmount(`split.shares.${index}.amountMinor`, share.amountMinor);
    if (!expenseIds.has(share.expenseId)) fail(`split.shares.${index}.expenseId`, 'expense does not exist');
    if (!peopleIds.has(share.personId)) fail(`split.shares.${index}.personId`, 'person does not exist');
  }

  const payerTotals = new Map<string, number>();
  for (const payer of backup.split.payers) {
    payerTotals.set(payer.expenseId, (payerTotals.get(payer.expenseId) ?? 0) + payer.amountMinor);
  }
  const shareTotals = new Map<string, number>();
  for (const share of backup.split.shares) {
    shareTotals.set(share.expenseId, (shareTotals.get(share.expenseId) ?? 0) + share.amountMinor);
  }
  for (const [index, expense] of backup.split.expenses.entries()) {
    if ((payerTotals.get(expense.id) ?? 0) !== expense.amountMinor) {
      fail(`split.expenses.${index}`, 'payer totals do not match expense amount');
    }
    if ((shareTotals.get(expense.id) ?? 0) !== expense.amountMinor) {
      fail(`split.expenses.${index}`, 'share totals do not match expense amount');
    }
  }

  for (const [index, settlement] of backup.split.settlements.entries()) {
    assertSafeAmount(`split.settlements.${index}.amountMinor`, settlement.amountMinor);
    const group = groupsById.get(settlement.groupId);
    if (!group) fail(`split.settlements.${index}.groupId`, 'group does not exist');
    if (!peopleIds.has(settlement.fromPersonId)) {
      fail(`split.settlements.${index}.fromPersonId`, 'person does not exist');
    }
    if (!peopleIds.has(settlement.toPersonId)) {
      fail(`split.settlements.${index}.toPersonId`, 'person does not exist');
    }
    if (settlement.fromPersonId === settlement.toPersonId) {
      fail(`split.settlements.${index}`, 'payer and receiver must be different people');
    }
    if (settlement.currency !== group.currency) {
      fail(`split.settlements.${index}.currency`, 'currency does not match its group');
    }
    if (!isValidDateOnly(settlement.date)) {
      fail(`split.settlements.${index}.date`, 'invalid calendar date');
    }
  }

  for (const [index, ledger] of backup.lend.ledgers.entries()) {
    if (!peopleIds.has(ledger.personId)) fail(`lend.ledgers.${index}.personId`, 'person does not exist');
  }
  for (const [index, entry] of backup.lend.entries.entries()) {
    assertSafeAmount(`lend.entries.${index}.amountMinor`, entry.amountMinor);
    if (!ledgerIds.has(entry.ledgerId)) fail(`lend.entries.${index}.ledgerId`, 'ledger does not exist');
    if (!isValidDateOnly(entry.date)) fail(`lend.entries.${index}.date`, 'invalid calendar date');
    if (entry.dueDate && !isValidDateOnly(entry.dueDate)) {
      fail(`lend.entries.${index}.dueDate`, 'invalid calendar date');
    }
    if (entry.type !== 'adjustment' && entry.amountMinor <= 0) {
      fail(`lend.entries.${index}.amountMinor`, 'non-adjustment amount must be positive');
    }
    if (entry.type === 'adjustment' && entry.amountMinor === 0) {
      fail(`lend.entries.${index}.amountMinor`, 'adjustment amount must not be zero');
    }
  }
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
