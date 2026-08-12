/**
 * Adapters that convert each module's records into
 * the unified `ActivityItem` model.
 *
 * Adapters are pure functions and never persisted.
 */

import type { ActivityItem } from '../projections/types';
import type {
  TrackTransaction,
  SplitExpense,
  SplitSettlement,
  LendEntry,
} from '@db/schema';
import type { CurrencyCode } from '@shared/money';

export function trackToActivity(t: TrackTransaction): ActivityItem {
  return {
    id: `track-${t.id}`,
    module: 'track',
    sourceEntityId: t.id,
    title: t.title,
    date: t.date,
    amountMinor: t.type === 'expense' ? -t.amountMinor : t.amountMinor,
    currency: t.currency,
  };
}

export function splitToActivity(
  e: SplitExpense,
  groupName: string,
  currency: CurrencyCode,
): ActivityItem {
  return {
    id: `split-${e.id}`,
    module: 'split',
    sourceEntityId: e.id,
    title: e.title,
    date: e.date,
    amountMinor: e.amountMinor,
    currency,
    context: groupName,
  };
}

export function splitSettlementToActivity(
  s: SplitSettlement,
  groupName: string,
): ActivityItem {
  return {
    id: `split-set-${s.id}`,
    module: 'split',
    sourceEntityId: s.id,
    title: 'Settlement',
    date: s.date,
    amountMinor: s.amountMinor,
    currency: s.currency,
    context: groupName,
  };
}

export function lendToActivity(e: LendEntry, personName: string): ActivityItem {
  const labels: Record<string, string> = {
    lent: `Lent ${personName}`,
    borrowed: `Borrowed from ${personName}`,
    repayment_received: `Repayment from ${personName}`,
    repayment_given: `Repayment to ${personName}`,
    adjustment: `Adjustment: ${personName}`,
  };
  const signed = (() => {
    switch (e.type) {
      case 'lent':
        return e.amountMinor;
      case 'borrowed':
        return -e.amountMinor;
      case 'repayment_received':
        return -e.amountMinor;
      case 'repayment_given':
        return e.amountMinor;
      case 'adjustment':
        return e.amountMinor;
    }
  })();
  return {
    id: `lend-${e.id}`,
    module: 'lend',
    sourceEntityId: e.id,
    title: labels[e.type] ?? e.type,
    date: e.date,
    amountMinor: signed,
    currency: 'INR', // overridden by caller
  };
}
