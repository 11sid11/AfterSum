/**
 * Dexie database.
 *
 * One database holds all the per-module tables. Overview is
 * intentionally not persisted here — it is a read-only
 * projection layer over the module tables.
 *
 * Each module owns its tables, but the db instance itself is
 * exported as a single shared singleton so transactions can
 * span tables when needed (e.g. creating a Split expense with
 * payers + shares atomically).
 */

import Dexie, { type Table } from 'dexie';
import type {
  Person,
  AppSettings,
  TrackCategory,
  TrackTransaction,
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
  SyncQueueItem,
  SyncMetadata,
} from './schema';

export const DB_NAME = 'finance-utility';

export class FinanceDB extends Dexie {
  // Shared
  people!: Table<Person, string>;
  settings!: Table<AppSettings, string>;

  // Track
  trackTransactions!: Table<TrackTransaction, string>;
  trackCategories!: Table<TrackCategory, string>;
  trackBudgets!: Table<TrackBudget, string>;
  trackRecurringRules!: Table<TrackRecurringRule, string>;

  // Split
  splitGroups!: Table<SplitGroup, string>;
  splitGroupMembers!: Table<SplitGroupMember, string>;
  splitExpenses!: Table<SplitExpense, string>;
  splitPayers!: Table<SplitPayer, string>;
  splitShares!: Table<SplitShare, string>;
  splitSettlements!: Table<SplitSettlement, string>;

  // Lend
  lendLedgers!: Table<LendLedger, string>;
  lendEntries!: Table<LendEntry, string>;

  // Sync
  syncQueue!: Table<SyncQueueItem, string>;
  syncMetadata!: Table<SyncMetadata, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      // People + settings
      people: 'id, name, isSelf, deletedAt',
      settings: 'id',

      // Track
      trackTransactions:
        'id, type, date, categoryId, paymentMethod, deletedAt, [type+date]',
      trackCategories: 'id, name, type, archived',
      trackBudgets: 'id, month',
      trackRecurringRules: 'id, frequency, nextDate, enabled',

      // Split
      splitGroups: 'id, name, archived',
      splitGroupMembers: 'id, groupId, personId, [groupId+personId], active',
      splitExpenses: 'id, groupId, date, deletedAt, [groupId+date]',
      splitPayers: 'id, expenseId, personId',
      splitShares: 'id, expenseId, personId',
      splitSettlements: 'id, groupId, fromPersonId, toPersonId, date, [groupId+date]',

      // Lend
      lendLedgers: 'id, personId, currency, archived, [personId+currency]',
      lendEntries: 'id, ledgerId, type, date, deletedAt, [ledgerId+date]',

      // Sync
      syncQueue: 'id, entity, entityId, op, createdAt',
      syncMetadata: 'id',
    });
  }
}

let _db: FinanceDB | null = null;

/**
 * Get (or create) the shared Dexie singleton.
 * Tests may pass a different `name` to keep their own store.
 */
export function getDB(name: string = DB_NAME): FinanceDB {
  if (!_db || _db.name !== name) {
    _db = new FinanceDB(name);
  }
  return _db;
}

/** Reset the singleton (testing). */
export function _resetDBForTests(): void {
  _db = null;
}
