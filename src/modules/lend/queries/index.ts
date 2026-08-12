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

/** All active ledgers, sorted by createdAt asc. */
export function useLendLedgers(): LendLedger[] | undefined {
  return useLiveQuery(async () => {
    const all = await getDB().lendLedgers.toArray();
    return all
      .filter((l) => !l.deletedAt)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }, []);
}

/** A single ledger by id. */
export function useLendLedger(id: string | undefined): LendLedger | undefined {
  return useLiveQuery(
    async () => (id ? (await getDB().lendLedgers.get(id)) ?? undefined : undefined),
    [id],
  );
}

/** The (single, V1) active ledger for a (person, currency) pair, if any. */
export function useLendLedgerForPerson(
  personId: string | undefined,
  currency: CurrencyCode,
): LendLedger | undefined {
  return useLiveQuery(
    async () => {
      if (!personId) return undefined;
      const all = await getDB().lendLedgers.toArray();
      return all.find(
        (l) => l.personId === personId && l.currency === currency && !l.deletedAt,
      );
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
        .filter((e) => !e.deletedAt)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
    },
    [ledgerId],
  );
}

/** All active entries across all of a person's ledgers. */
export function useLendEntriesForPerson(personId: string | undefined): LendEntry[] | undefined {
  return useLiveQuery(
    async () => {
      if (!personId) return [];
      const db = getDB();
      const ledgers = (await db.lendLedgers.toArray()).filter(
        (l) => l.personId === personId && !l.deletedAt,
      );
      if (ledgers.length === 0) return [];
      const out: LendEntry[] = [];
      for (const l of ledgers) {
        const entries = await db.lendEntries.where('ledgerId').equals(l.id).toArray();
        for (const e of entries) if (!e.deletedAt) out.push(e);
      }
      out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
      return out;
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
    return all.filter((e) => !e.deletedAt);
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
  const ledgersAll = useLendLedgers();
  const entriesAll = useLiveQuery(async () => {
    const all = await getDB().lendEntries.toArray();
    return all.filter((e) => !e.deletedAt);
  }, []);

  return useMemo(() => {
    if (!personId || !ledgersAll || !entriesAll) return undefined;
    const ledgers = ledgersAll.filter((l) => l.personId === personId);
    const ledgerIds = new Set(ledgers.map((l) => l.id));
    const entries = entriesAll
      .filter((e) => ledgerIds.has(e.ledgerId))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
    const totalBalance = personBalanceFromLedgers(ledgersAll, entriesAll, personId);
    return {
      ledgers,
      totalBalance,
      entries,
      currency: ledgers[0]?.currency,
    };
  }, [personId, ledgersAll, entriesAll]);
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
  const ledger = useLendLedgers();
  const settings = useAppSettings();
  if (personId && ledger) {
    const found = ledger.find((l) => l.personId === personId);
    if (found) return found.currency;
  }
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
    return all.filter((e) => !e.deletedAt);
  }, []);

  return useMemo(() => {
    if (!people || !ledgers || !entries) return undefined;
    return personSummary(people, ledgers, entries);
  }, [people, ledgers, entries]);
}

export { ledgerBalance, personBalanceFromLedgers };
