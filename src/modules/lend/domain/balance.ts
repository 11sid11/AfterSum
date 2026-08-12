/**
 * Lend balance engine.
 *
 * All balance math is pure and lives here. Repositories
 * never sum entries themselves; they return rows and let
 * the domain do the math.
 *
 * Sign convention (single source of truth in `signs.ts`):
 *   positive  = they owe me
 *   negative  = I owe them
 *
 * Soft-deleted entries are NEVER counted. The caller must
 * either pass the filtered list or rely on the
 * `*ForActive` helpers below.
 */

import type { LendEntry, LendLedger, Person } from '@db/schema';
import { entryToSignedAmount } from './signs';
import { sumMinor } from '@shared/money';

// --------------------------------------------------------------------
// Low-level helpers
// --------------------------------------------------------------------

/** True if the row is not soft-deleted. */
export function isActive<T extends { deletedAt?: string }>(row: T): boolean {
  return !row.deletedAt;
}

/** Filter out soft-deleted entries. */
export function activeEntries(entries: LendEntry[]): LendEntry[] {
  return entries.filter(isActive);
}

/** Filter out soft-deleted ledgers. */
export function activeLedgers(ledgers: LendLedger[]): LendLedger[] {
  return ledgers.filter(isActive);
}

// --------------------------------------------------------------------
// Balance computations
// --------------------------------------------------------------------

/**
 * Sum the signed amounts of a list of entries.
 *
 * Soft-deleted entries are skipped. The result is a single
 * integer in minor units.
 */
export function ledgerBalance(entries: LendEntry[]): number {
  return sumMinor(activeEntries(entries).map(entryToSignedAmount));
}

/**
 * Sum the balance a person owes/is owed across ALL of
 * their (active) Lend ledgers.
 */
export function personBalanceFromLedgers(
  ledgers: LendLedger[],
  entries: LendEntry[],
  personId: string,
): number {
  const active = activeLedgers(ledgers).filter((l) => l.personId === personId);
  if (active.length === 0) return 0;
  const ledgerIds = new Set(active.map((l) => l.id));
  const personEntries = activeEntries(entries).filter((e) => ledgerIds.has(e.ledgerId));
  return sumMinor(personEntries.map(entryToSignedAmount));
}

/**
 * Sum of all positive NET balances across all people.
 *
 * A person "owes you" the net of their ledger. We do NOT
 * sum raw entry values: lent 1000 + repayment 800 means
 * you will receive 200, not 1800 (the 1000 lent and the
 * 800 repaid partially cancel).
 */
export function receivableTotal(
  ledgers: LendLedger[],
  entries: LendEntry[],
): number {
  const active = activeLedgers(ledgers);
  if (active.length === 0) return 0;
  const ledgerIds = new Set(active.map((l) => l.id));
  const entryBalances = new Map<string, number>();
  for (const e of activeEntries(entries)) {
    if (!ledgerIds.has(e.ledgerId)) continue;
    entryBalances.set(e.ledgerId, (entryBalances.get(e.ledgerId) ?? 0) + entryToSignedAmount(e));
  }
  // Aggregate per person, then sum only positives.
  const byPerson = new Map<string, number>();
  for (const l of active) {
    byPerson.set(l.personId, (byPerson.get(l.personId) ?? 0) + (entryBalances.get(l.id) ?? 0));
  }
  return sumMinor([...byPerson.values()].filter((n) => n > 0));
}

/**
 * Sum of all negative NET balances across all people,
 * returned as a positive integer.
 *
 * "How much do I owe people in total?"
 */
export function payableTotal(
  ledgers: LendLedger[],
  entries: LendEntry[],
): number {
  const active = activeLedgers(ledgers);
  if (active.length === 0) return 0;
  const ledgerIds = new Set(active.map((l) => l.id));
  const entryBalances = new Map<string, number>();
  for (const e of activeEntries(entries)) {
    if (!ledgerIds.has(e.ledgerId)) continue;
    entryBalances.set(e.ledgerId, (entryBalances.get(e.ledgerId) ?? 0) + entryToSignedAmount(e));
  }
  const byPerson = new Map<string, number>();
  for (const l of active) {
    byPerson.set(l.personId, (byPerson.get(l.personId) ?? 0) + (entryBalances.get(l.id) ?? 0));
  }
  return Math.abs(sumMinor([...byPerson.values()].filter((n) => n < 0)));
}

// --------------------------------------------------------------------
// Aggregations for UI
// --------------------------------------------------------------------

export interface PersonSummary {
  person: Person;
  /** Per-ledger summary so the UI can show the breakdown later. */
  ledgers: LendLedger[];
  /** Net balance across all of the person's ledgers. */
  balanceMinor: number;
  /**
   * Currency code. We only attach one because V1 supports a
   * single currency per (person) in the dashboard, and the UI
   * collapses cross-currency ledgers to the first ledger's
   * currency. Cross-currency aggregation is out of scope for
   * V1 (Overview does not display this number).
   */
  currency: string;
}

/**
 * Build a per-person summary used by the dashboard and the
 * person-detail screen.
 *
 * The function tolerates missing/empty ledgers by returning
 * one row per person that has at least one active ledger.
 * The currency is the first active ledger's currency; for
 * multi-currency persons the caller can iterate over
 * `ledgers` directly.
 */
export function personSummary(
  people: Person[],
  ledgers: LendLedger[],
  entries: LendEntry[],
): PersonSummary[] {
  const active = activeLedgers(ledgers);
  const byPerson = new Map<string, LendLedger[]>();
  for (const l of active) {
    const arr = byPerson.get(l.personId);
    if (arr) arr.push(l);
    else byPerson.set(l.personId, [l]);
  }
  const out: PersonSummary[] = [];
  for (const person of people) {
    if (person.isSelf) continue;
    if (person.deletedAt) continue;
    const personLedgers = byPerson.get(person.id);
    if (!personLedgers || personLedgers.length === 0) continue;
    const balance = personBalanceFromLedgers(ledgers, entries, person.id);
    out.push({
      person,
      ledgers: personLedgers,
      balanceMinor: balance,
      currency: personLedgers[0]!.currency,
    });
  }
  // Sort: positive balances first (largest), then negative
  // (largest in absolute), then zero. Within each group,
  // alphabetical by person name.
  out.sort((a, b) => {
    const absA = Math.abs(a.balanceMinor);
    const absB = Math.abs(b.balanceMinor);
    const aPos = a.balanceMinor > 0;
    const bPos = b.balanceMinor > 0;
    if (aPos !== bPos) return aPos ? -1 : 1;
    if (absA !== absB) return absB - absA;
    return a.person.name.localeCompare(b.person.name);
  });
  return out;
}

export interface DashboardSummary {
  /** Total of positive balances (people owe me). */
  youWillReceive: number;
  /** Total of negative balances, as a positive integer. */
  youOwe: number;
  /** Per-person rows. */
  people: PersonSummary[];
}

/** Compute the dashboard summary in one pass. */
export function dashboardSummary(
  people: Person[],
  ledgers: LendLedger[],
  entries: LendEntry[],
): DashboardSummary {
  return {
    youWillReceive: receivableTotal(ledgers, entries),
    youOwe: payableTotal(ledgers, entries),
    people: personSummary(people, ledgers, entries),
  };
}

// --------------------------------------------------------------------
// Recent activity
// --------------------------------------------------------------------

/**
 * Return the N most recent active entries (across all
 * ledgers), sorted by `date` desc, breaking ties by
 * `createdAt` desc.
 */
export function recentEntries(entries: LendEntry[], limit: number): LendEntry[] {
  const active = activeEntries(entries);
  active.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
  return active.slice(0, Math.max(0, limit));
}
