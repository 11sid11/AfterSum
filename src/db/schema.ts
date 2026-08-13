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
  googleSyncEnabled: boolean;
  /** Stable Google account subject identifier. */
  googleAccountId?: string;
  /** Display-only account label; never use email as the identity key. */
  googleAccountEmail?: string;
  googleSpreadsheetId?: string;
  googleFolderId?: string;
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

export interface SplitGroup extends BaseEntity {
  name: string;
  description?: string;
  currency: CurrencyCode;
  archived: boolean;
}

export interface SplitGroupMember extends BaseEntity {
  groupId: string;
  personId: string;
  active: boolean;
  joinedAt: string;
}

export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares';

/** Lightweight trip-expense categories, matching the focused Trip Split workflow. */
export type SplitExpenseCategory =
  | 'food'
  | 'stay'
  | 'travel'
  | 'fun'
  | 'shopping'
  | 'other';

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

// ---------- Sync ----------

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
  id: 'google';
  status: SyncStatus;
  dirty: boolean;
  lastLocalChangeAt?: string;
  lastSuccessfulSyncAt?: string;
  lastError?: string;
}
