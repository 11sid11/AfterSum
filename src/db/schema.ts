/**
 * Domain entity types.
 *
 * FINANCIAL MODULE ISOLATION
 *
 * Track, Split, and Lend are independent financial ledgers.
 *
 * Shared Person records represent identity only and never contain
 * global financial balances.
 *
 * A balance belonging to one Split group must not alter another
 * Split group, a Lend ledger, or Track.
 *
 * Lend transactions must never implicitly alter Split or Track.
 *
 * Track transactions must never implicitly alter Split or Lend.
 *
 * The Overview layer may aggregate and calculate informational
 * projections across modules, but must remain read-only.
 *
 * Cross-module reconciliation may only be introduced as an
 * explicit user-confirmed feature.
 */

import type { CurrencyCode } from '@shared/money';

/** Base shape every persisted entity must have. */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  revision: number;
}

// ---------- Shared ----------

export interface Person extends BaseEntity {
  name: string;
  phone?: string;
  email?: string;
  note?: string;
  isSelf?: boolean;
}

export type AppTheme = 'system' | 'light' | 'dark';

export interface AppSettings extends BaseEntity {
  id: 'app';
  defaultCurrency: CurrencyCode;
  theme: AppTheme;
  hideAmounts: boolean;
  /** Last time this device successfully handed a portable backup to the user. */
  lastPortableBackupAt?: string;
  onboardingComplete: boolean;
}

// ---------- Track ----------

export type TrackCategoryType = 'expense' | 'income';

export interface TrackCategory extends BaseEntity {
  name: string;
  type: TrackCategoryType;
  icon?: string;
  archived: boolean;
}

export type TrackTransactionType = 'expense' | 'income';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other';

export interface TrackTransaction extends BaseEntity {
  type: TrackTransactionType;
  title: string;
  amountMinor: number;
  currency: CurrencyCode;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  /** YYYY-MM-DD */
  date: string;
  note?: string;
}

export interface TrackBudget extends BaseEntity {
  /** YYYY-MM */
  month: string;
  amountMinor: number;
  currency: CurrencyCode;
}

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

export interface TrackRecurringRule extends BaseEntity {
  title: string;
  amountMinor?: number;
  currency: CurrencyCode;
  categoryId?: string;
  frequency: RecurringFrequency;
  /** YYYY-MM-DD */
  nextDate: string;
  enabled: boolean;
}

// ---------- Split ----------

export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares';
export type SplitRecurringFrequency = 'weekly' | 'monthly' | 'yearly';

/** Lightweight trip-expense categories, matching the focused Trip Split workflow. */
export type SplitExpenseCategory =
  | 'food'
  | 'stay'
  | 'travel'
  | 'fun'
  | 'shopping'
  | 'other';

/**
 * Optional allocation snapshot used by saved defaults and recurring templates.
 * Amounts are integer minor units; percentages are 0..100; shares are positive integers.
 */
export interface SplitAllocationSnapshot {
  exactAmountsByPersonId?: Record<string, number>;
  percentagesByPersonId?: Record<string, number>;
  sharesByPersonId?: Record<string, number>;
}

/**
 * Per-trip convenience only. This is not financial history.
 * Exact splits are intentionally not saved as defaults because they depend on a specific total.
 */
export interface SplitDefaultSplit {
  payerPersonId?: string;
  participantIds: string[];
  splitMethod: Exclude<SplitMethod, 'exact'>;
  allocation?: SplitAllocationSnapshot;
}

/**
 * Manual itemization metadata. Final accounting still collapses into SplitShare rows,
 * so the existing balance engine remains the single source of truth.
 */
export interface SplitItem {
  id: string;
  title: string;
  amountMinor: number;
  participantIds: string[];
}

/**
 * Local recurring instruction. Occurrences become ordinary SplitExpense events.
 * `anchorDate` preserves the user's original calendar intent while `nextDate`
 * tracks the next occurrence that has not yet been materialized.
 */
export interface SplitRecurringTemplate {
  id: string;
  title: string;
  amountMinor: number;
  category?: SplitExpenseCategory;
  payerPersonId: string;
  participantIds: string[];
  splitMethod: SplitMethod;
  allocation?: SplitAllocationSnapshot;
  note?: string;
  frequency: SplitRecurringFrequency;
  /** Original YYYY-MM-DD used to preserve day-of-month/year recurrence semantics. */
  anchorDate: string;
  /** Next YYYY-MM-DD occurrence that has not yet been generated. */
  nextDate: string;
  enabled: boolean;
  originalCurrency?: CurrencyCode;
  originalAmountMinor?: number;
  exchangeRate?: number;
  items?: SplitItem[];
}

export interface SplitGroup extends BaseEntity {
  name: string;
  description?: string;
  currency: CurrencyCode;
  archived: boolean;
  /** Optional per-trip entry defaults. Safe to remove without changing financial history. */
  defaultSplit?: SplitDefaultSplit;
  /** Local recurring instructions; generated expenses remain the accounting source of truth. */
  recurringTemplates?: SplitRecurringTemplate[];
}

export interface SplitGroupMember extends BaseEntity {
  groupId: string;
  personId: string;
  active: boolean;
  joinedAt: string;
}

export interface SplitExpense extends BaseEntity {
  groupId: string;
  title: string;
  amountMinor: number;
  currency: CurrencyCode;
  /** YYYY-MM-DD */
  date: string;
  splitMethod: SplitMethod;
  /** Optional for backward compatibility with expenses created before categories existed. */
  category?: SplitExpenseCategory;
  note?: string;
  /** Optional reference to the amount actually paid before manual conversion to trip currency. */
  originalCurrency?: CurrencyCode;
  originalAmountMinor?: number;
  /** Base-currency units per one original-currency unit. */
  exchangeRate?: number;
  /** Optional manual itemization metadata; balances still come from SplitShare rows. */
  items?: SplitItem[];
  /** Present only for materialized recurring occurrences. */
  recurrenceTemplateId?: string;
  /** YYYY-MM-DD occurrence key used for idempotency. */
  recurrenceOccurrenceDate?: string;
  /** Stable local source key used to skip duplicate CSV rows on re-import. */
  importSourceKey?: string;
}

export interface SplitPayer extends BaseEntity {
  expenseId: string;
  personId: string;
  amountMinor: number;
}

export interface SplitShare extends BaseEntity {
  expenseId: string;
  personId: string;
  amountMinor: number;
}

export interface SplitSettlement extends BaseEntity {
  groupId: string;
  fromPersonId: string;
  toPersonId: string;
  amountMinor: number;
  currency: CurrencyCode;
  /** YYYY-MM-DD */
  date: string;
  note?: string;
}

// ---------- Lend ----------

export interface LendLedger extends BaseEntity {
  personId: string;
  currency: CurrencyCode;
  label?: string;
  archived: boolean;
}

export type LendEntryType =
  | 'lent'
  | 'borrowed'
  | 'repayment_received'
  | 'repayment_given'
  | 'adjustment';

export interface LendEntry extends BaseEntity {
  ledgerId: string;
  type: LendEntryType;
  amountMinor: number;
  /** YYYY-MM-DD */
  date: string;
  dueDate?: string;
  note?: string;
}

// ---------- Local recovery ----------

export type RecoverySnapshotReason = 'daily' | 'before_restore';

/**
 * Local-only recovery point. The payload is the validated portable backup JSON.
 * Recovery snapshots are deliberately excluded from portable backups so they
 * cannot recursively contain themselves.
 */
export interface RecoverySnapshot {
  id: string;
  createdAt: string;
  reason: RecoverySnapshotReason;
  payload: string;
}

// ---------- Legacy change tracking ----------

/**
 * These types remain for database compatibility with the existing local write
 * pipeline. They do not imply a network service or cloud account.
 */
export type SyncOp = 'create' | 'update' | 'delete';

export interface SyncQueueItem extends BaseEntity {
  entity:
    | 'person'
    | 'trackTransaction'
    | 'trackCategory'
    | 'trackBudget'
    | 'trackRecurringRule'
    | 'splitGroup'
    | 'splitGroupMember'
    | 'splitExpense'
    | 'splitSettlement'
    | 'lendLedger'
    | 'lendEntry';
  entityId: string;
  op: SyncOp;
  payload?: unknown;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
}

export type SyncStatus =
  | 'saved'
  | 'offline'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'auth_required'
  | 'error';

export interface SyncMetadata extends BaseEntity {
  /** Legacy key retained to avoid a destructive IndexedDB migration. */
  id: 'google';
  status: SyncStatus;
  dirty: boolean;
  lastLocalChangeAt?: string;
  lastSuccessfulSyncAt?: string;
  lastError?: string;
}
