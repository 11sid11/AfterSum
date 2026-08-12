/**
 * Overview types — derived read-only models.
 *
 * Overview NEVER persists anything. It is a pure read layer
 * over Track, Split, Lend tables.
 */

import type { CurrencyCode } from '@shared/money';

export type OverviewModule = 'track' | 'split' | 'lend';

export interface ActivityItem {
  id: string;
  module: OverviewModule;
  sourceEntityId: string;
  title: string;
  date: string;
  amountMinor: number;
  currency: CurrencyCode;
  context?: string;
}

export interface PersonExposure {
  personId: string;
  personName: string;
  contexts: Array<{
    module: 'split' | 'lend';
    contextId: string;
    contextName: string;
    balanceMinor: number;
    currency: CurrencyCode;
  }>;
  /** Only set when all contexts use the same currency. */
  informationalNetMinor?: number;
}

export interface OverviewSummary {
  month: string;
  track: {
    spentMinor: number;
    incomeMinor: number;
    currency: CurrencyCode;
    budgetMinor?: number;
    budgetRemainingMinor?: number;
  };
  split: {
    youAreOwedMinor: number;
    youOweMinor: number;
    currency: CurrencyCode;
  };
  lend: {
    youWillReceiveMinor: number;
    youOweMinor: number;
    currency: CurrencyCode;
  };
}
