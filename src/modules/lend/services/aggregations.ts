/**
 * Lend high-level services.
 *
 * Most of the math lives in `domain/balance.ts` (pure
 * functions). This module provides the "use a database
 * reference" wrappers that the dashboard and detail
 * screens reach for, plus cross-ledger convenience
 * helpers used by Overview.
 */

import { getDB } from '@db/database';
import { personRepository } from '@shared/people/repository';
import {
  dashboardSummary,
  personBalanceFromLedgers,
  receivableTotal,
  payableTotal,
  type DashboardSummary,
} from '../domain/balance';
import type { LendEntry, LendLedger, Person } from '@db/schema';
import type { CurrencyCode } from '@shared/money';

export interface PersonExposure {
  person: Person;
  balanceMinor: number;
  currency: CurrencyCode;
  ledgerIds: string[];
}

/** Fetch all active lend data from the DB. */
export async function loadLendSnapshot(): Promise<{
  people: Person[];
  ledgers: LendLedger[];
  entries: LendEntry[];
}> {
  const db = getDB();
  const [allPeople, allLedgers, allEntries] = await Promise.all([
    personRepository.listActive(),
    db.lendLedgers.toArray(),
    db.lendEntries.toArray(),
  ]);
  return {
    people: allPeople,
    ledgers: allLedgers.filter((l) => !l.deletedAt),
    entries: allEntries.filter((e) => !e.deletedAt),
  };
}

/** Compute the dashboard summary from the live DB. */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { people, ledgers, entries } = await loadLendSnapshot();
  return dashboardSummary(people, ledgers, entries);
}

/** Per-person total balance, for Overview aggregation. */
export async function getPersonExposures(): Promise<PersonExposure[]> {
  const { people, ledgers, entries } = await loadLendSnapshot();
  const exposures: PersonExposure[] = [];
  for (const person of people) {
    if (person.isSelf) continue;
    const personLedgers = ledgers.filter((l) => l.personId === person.id);
    if (personLedgers.length === 0) continue;
    const balance = personBalanceFromLedgers(ledgers, entries, person.id);
    if (balance === 0) continue;
    exposures.push({
      person,
      balanceMinor: balance,
      currency: personLedgers[0]!.currency,
      ledgerIds: personLedgers.map((l) => l.id),
    });
  }
  return exposures;
}

export { receivableTotal, payableTotal };
