/**
 * Lend live queries.
 *
 * Reactive helpers backed by Dexie's `useLiveQuery`. The
 * UI subscribes to these and re-renders automatically
 * after any Lend write.
 *
 * Module independence: this file MUST NOT import from
 * `modules/track/` or `modules/split/`. Only shared
 * Person / Settings are joined in.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import { useMemo } from 'react';
import { usePeople } from '@shared/people/queries';
import { useAppSettings } from '@shared/settings/useSettings';
import {
  dashboardSummary,
  personSummary,
  ledgerBalance,
  personBalanceFromLedgers,
  recentEntries,
  type DashboardSummary,
  type PersonSummary,
} from '../domain/balance';
import type { CurrencyCode } from '@shared/money';
import type { LendEntry, LendLedger } from '@db/schema';

// --------------------------------------------------------------------
// Raw table queries
// --------------------------------------------------------------------

/** All active, non-archived ledgers, sorted by createdAt asc. */
export function useLendLedgers(): LendLedger[] | undefined {
  return useLiveQuery(async () => {
    const all = await getDB().lendLedgers.toArray();
    return all
      .filter((ledger) => !ledger.deletedAt && !ledger.archived)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }, []);
}

/** All active, non-archived ledgers for one person, sorted by createdAt asc. */
export function useLendLedgersForPerson(personId: string | undefined): LendLedger[] | undefined {
  return useLiveQuery(
    async () => {
      if (!personId) return [];
      const rows = await getDB().lendLedgers.where('personId').equals(personId).toArray();
      return rows
        .filter((ledger) => !ledger.deletedAt && !ledger.archived)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    },
    [personId],
  );
}

/** A single ledger by id. */
export function useLendLedger(id: string | undefined): LendLedger | undefined {
  return useLiveQuery(
    async () => (id ? (await getDB().lendLedgers.get(id)) ?? undefined : undefined),
    [id],
  );
}

/** The active ledger for a (person, currency) pair, if any. */
export function useLendLedgerForPerson(
  personId: string | undefined,
  currency: CurrencyCode,
): LendLedger | undefined {
  return useLiveQuery(
    async () => {
      if (!personId) return undefined;
      return getDB()
        .lendLedgers.where('[personId+currency]')
        .equals([personId, currency])
        .filter((ledger) => !ledger.deletedAt && !ledger.archived)
        .first();
    },
    [personId, currency],
  );
}

/** All active entries for a single ledger, newest first. */
export function useLendEntriesForLedger(ledgerId: string | undefined): LendEntry[] | undefined {
  return useLiveQuery(
    async () => {
      if (!ledgerId) return [];
      const all = await getDB().lendEntries.where('ledgerId').equals(ledgerId).toArray();
      return all
        .filter((entry) => !entry.deletedAt)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
    },
    [ledgerId],
  );
}

/** All active entries across all of a person's active ledgers. */
export function useLendEntriesForPerson(personId: string | undefined): LendEntry[] | undefined {
  return useLiveQuery(
    async () => {
      if (!personId) return [];
      const db = getDB();
      const ledgers = (await db.lendLedgers.where('personId').equals(personId).toArray()).filter(
        (ledger) => !ledger.deletedAt && !ledger.archived,
      );
      if (ledgers.length === 0) return [];

      const entryBatches = await Promise.all(
        ledgers.map((ledger) => db.lendEntries.where('ledgerId').equals(ledger.id).toArray()),
      );
      return entryBatches
        .flat()
        .filter((entry) => !entry.deletedAt)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
    },
    [personId],
  );
}

// --------------------------------------------------------------------
// Composed queries
// --------------------------------------------------------------------

/** Dashboard summary. */
export function useLendDashboard(): DashboardSummary | undefined {
  const people = usePeople();
  const ledgers = useLendLedgers();
  const entries = useLiveQuery(async () => {
    const all = await getDB().lendEntries.toArray();
    return all.filter((entry) => !entry.deletedAt);
  }, []);

  return useMemo(() => {
    if (!people || !ledgers || !entries) return undefined;
    return dashboardSummary(people, ledgers, entries);
  }, [people, ledgers, entries]);
}

export interface LendPersonDetail {
  ledgers: LendLedger[];
  totalBalance: number;
  entries: LendEntry[];
  currency: string | undefined;
}

/**
 * Per-person detail (ledgers, total balance, all entries).
 * Cross-currency totals are NOT collapsed in V1; the
 * dashboard shows the per-currency numbers side by side.
 */
export function useLendPersonDetail(personId: string | undefined): LendPersonDetail | undefined {
  const ledgers = useLendLedgersForPerson(personId);
  const entries = useLendEntriesForPerson(personId);

  return useMemo(() => {
    if (!personId || !ledgers || !entries) return undefined;
    return {
      ledgers,
      totalBalance: personBalanceFromLedgers(ledgers, entries, personId),
      entries,
      currency: ledgers[0]?.currency,
    };
  }, [personId, ledgers, entries]);
}

/** Recent activity across all ledgers (top N). */
export function useRecentLendEntries(limit: number = 20): LendEntry[] | undefined {
  return useLiveQuery(
    async () => {
      const all = await getDB().lendEntries.toArray();
      return recentEntries(all, limit);
    },
    [limit],
  );
}

// --------------------------------------------------------------------
// UI helpers
// --------------------------------------------------------------------

/**
 * Returns the default currency for a person in the Lend
 * module: the first active ledger's currency, or the
 * app's defaultCurrency if the person has no ledgers yet.
 */
export function useDefaultLendCurrency(personId: string | undefined): CurrencyCode {
  const ledgers = useLendLedgersForPerson(personId);
  const settings = useAppSettings();
  if (ledgers?.[0]) return ledgers[0].currency;
  return settings?.defaultCurrency ?? 'INR';
}

/**
 * Pure projection used by the dashboard: per-person rows
 * sorted by absolute balance desc. Kept here so the
 * composition layer and the tests can share it.
 */
export function useLendPeople(): PersonSummary[] | undefined {
  const people = usePeople();
  const ledgers = useLendLedgers();
  const entries = useLiveQuery(async () => {
    const all = await getDB().lendEntries.toArray();
    return all.filter((entry) => !entry.deletedAt);
  }, []);

  return useMemo(() => {
    if (!people || !ledgers || !entries) return undefined;
    return personSummary(people, ledgers, entries);
  }, [people, ledgers, entries]);
}

export { ledgerBalance, personBalanceFromLedgers };
