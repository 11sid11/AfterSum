/**
 * Lend balance engine tests.
 *
 * Pure-function tests for ledgerBalance, personBalanceFromLedgers,
 * receivableTotal, payableTotal, personSummary, and recentEntries.
 */

import { describe, it, expect } from 'vitest';
import {
  ledgerBalance,
  personBalanceFromLedgers,
  receivableTotal,
  payableTotal,
  personSummary,
  recentEntries,
  activeEntries,
  dashboardSummary,
} from './balance';
import { entryToSignedAmount } from './signs';
import type { LendEntry, LendLedger, Person } from '@db/schema';

function makeEntry(overrides: Partial<LendEntry> & Pick<LendEntry, 'type' | 'amountMinor' | 'ledgerId' | 'date'>): LendEntry {
  return {
    id: overrides.id ?? `e-${Math.random().toString(36).slice(2, 8)}`,
    ledgerId: overrides.ledgerId,
    type: overrides.type,
    amountMinor: overrides.amountMinor,
    date: overrides.date,
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00.000Z',
    revision: 1,
    note: overrides.note,
    dueDate: overrides.dueDate,
    deletedAt: overrides.deletedAt,
  };
}

function makeLedger(overrides: Partial<LendLedger> & Pick<LendLedger, 'personId' | 'currency'>): LendLedger {
  return {
    id: overrides.id ?? `l-${Math.random().toString(36).slice(2, 8)}`,
    personId: overrides.personId,
    currency: overrides.currency,
    label: overrides.label,
    archived: overrides.archived ?? false,
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00.000Z',
    revision: 1,
    deletedAt: overrides.deletedAt,
  };
}

function makePerson(overrides: Partial<Person> & Pick<Person, 'name'>): Person {
  return {
    id: overrides.id ?? `p-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name,
    phone: overrides.phone,
    email: overrides.email,
    note: overrides.note,
    isSelf: overrides.isSelf ?? false,
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00.000Z',
    revision: 1,
    deletedAt: overrides.deletedAt,
  };
}

describe('Lend balance engine', () => {
  describe('ledgerBalance', () => {
    it('is zero for an empty ledger', () => {
      expect(ledgerBalance([])).toBe(0);
    });

    it('sums the signed amounts of all active entries', () => {
      const entries = [
        makeEntry({ type: 'lent', amountMinor: 500000, ledgerId: 'L', date: '2024-01-01' }),
        makeEntry({ type: 'repayment_received', amountMinor: 200000, ledgerId: 'L', date: '2024-02-01' }),
        makeEntry({ type: 'lent', amountMinor: 100000, ledgerId: 'L', date: '2024-03-01' }),
      ];
      expect(ledgerBalance(entries)).toBe(400000);
    });

    it('skips soft-deleted entries', () => {
      const entries = [
        makeEntry({ type: 'lent', amountMinor: 500000, ledgerId: 'L', date: '2024-01-01' }),
        makeEntry({
          type: 'repayment_received',
          amountMinor: 200000,
          ledgerId: 'L',
          date: '2024-02-01',
          deletedAt: '2024-02-02T00:00:00.000Z',
        }),
      ];
      expect(ledgerBalance(entries)).toBe(500000);
    });

    it('handles a negative balance (I owe them)', () => {
      const entries = [
        makeEntry({ type: 'borrowed', amountMinor: 500000, ledgerId: 'L', date: '2024-01-01' }),
        makeEntry({ type: 'repayment_given', amountMinor: 200000, ledgerId: 'L', date: '2024-02-01' }),
      ];
      expect(ledgerBalance(entries)).toBe(-300000);
    });
  });

  describe('personBalanceFromLedgers', () => {
    it('sums balances across multiple ledgers of the same person', () => {
      const ledgers = [
        makeLedger({ id: 'L1', personId: 'P', currency: 'INR' }),
        makeLedger({ id: 'L2', personId: 'P', currency: 'USD' }),
      ];
      const entries = [
        makeEntry({ type: 'lent', amountMinor: 500000, ledgerId: 'L1', date: '2024-01-01' }),
        makeEntry({ type: 'lent', amountMinor: 200000, ledgerId: 'L2', date: '2024-01-01' }),
        // A different person's ledger should be ignored.
        makeEntry({ type: 'lent', amountMinor: 999999, ledgerId: 'OTHER', date: '2024-01-01' }),
      ];
      const balance = personBalanceFromLedgers(ledgers, entries, 'P');
      expect(balance).toBe(700000);
    });

    it('ignores other people and deleted ledgers', () => {
      const ledgers = [
        makeLedger({ id: 'L1', personId: 'P', currency: 'INR' }),
        makeLedger({ id: 'L2', personId: 'P', currency: 'INR', deletedAt: '2024-01-01T00:00:00.000Z' }),
        makeLedger({ id: 'L3', personId: 'OTHER', currency: 'INR' }),
      ];
      const entries = [
        makeEntry({ type: 'lent', amountMinor: 500000, ledgerId: 'L1', date: '2024-01-01' }),
        makeEntry({ type: 'lent', amountMinor: 100000, ledgerId: 'L2', date: '2024-01-01' }),
        makeEntry({ type: 'lent', amountMinor: 999999, ledgerId: 'L3', date: '2024-01-01' }),
      ];
      expect(personBalanceFromLedgers(ledgers, entries, 'P')).toBe(500000);
    });
  });

  describe('receivableTotal / payableTotal', () => {
    it('sums positive balances only for receivable', () => {
      const ledgers = [
        makeLedger({ id: 'L1', personId: 'P1', currency: 'INR' }),
        makeLedger({ id: 'L2', personId: 'P2', currency: 'INR' }),
      ];
      const entries = [
        makeEntry({ type: 'lent', amountMinor: 500000, ledgerId: 'L1', date: '2024-01-01' }),
        makeEntry({ type: 'borrowed', amountMinor: 200000, ledgerId: 'L2', date: '2024-01-01' }),
      ];
      expect(receivableTotal(ledgers, entries)).toBe(500000);
    });

    it('returns payable as a positive integer (sum of |negatives|)', () => {
      const ledgers = [makeLedger({ id: 'L1', personId: 'P1', currency: 'INR' })];
      const entries = [
        makeEntry({ type: 'borrowed', amountMinor: 500000, ledgerId: 'L1', date: '2024-01-01' }),
        makeEntry({ type: 'repayment_given', amountMinor: 200000, ledgerId: 'L1', date: '2024-02-01' }),
      ];
      expect(payableTotal(ledgers, entries)).toBe(300000);
    });

    it('returns 0 for empty / fully-settled ledgers', () => {
      const ledgers = [makeLedger({ id: 'L1', personId: 'P1', currency: 'INR' })];
      const entries = [
        makeEntry({ type: 'lent', amountMinor: 100000, ledgerId: 'L1', date: '2024-01-01' }),
        makeEntry({
          type: 'repayment_received',
          amountMinor: 100000,
          ledgerId: 'L1',
          date: '2024-02-01',
        }),
      ];
      expect(receivableTotal(ledgers, entries)).toBe(0);
      expect(payableTotal(ledgers, entries)).toBe(0);
    });
  });

  describe('personSummary', () => {
    it('produces one row per person with active ledgers', () => {
      const people = [
        makePerson({ id: 'P1', name: 'Alice' }),
        makePerson({ id: 'P2', name: 'Bob' }),
        makePerson({ id: 'SELF', name: 'Me', isSelf: true }),
      ];
      const ledgers = [
        makeLedger({ id: 'L1', personId: 'P1', currency: 'INR' }),
        makeLedger({ id: 'L2', personId: 'P2', currency: 'INR' }),
      ];
      const entries = [
        makeEntry({ type: 'lent', amountMinor: 500000, ledgerId: 'L1', date: '2024-01-01' }),
        makeEntry({ type: 'borrowed', amountMinor: 100000, ledgerId: 'L2', date: '2024-01-01' }),
      ];
      const rows = personSummary(people, ledgers, entries);
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.person.id === 'P1')?.balanceMinor).toBe(500000);
      expect(rows.find((r) => r.person.id === 'P2')?.balanceMinor).toBe(-100000);
    });

    it('skips people with no active ledgers and the self person', () => {
      const people = [
        makePerson({ id: 'P1', name: 'Alice' }),
        makePerson({ id: 'LONELY', name: 'No Ledger' }),
      ];
      const ledgers = [makeLedger({ id: 'L1', personId: 'P1', currency: 'INR' })];
      const entries: LendEntry[] = [];
      const rows = personSummary(people, ledgers, entries);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.person.id).toBe('P1');
    });
  });

  describe('dashboardSummary', () => {
    it('aggregates the dashboard numbers', () => {
      const people = [makePerson({ id: 'P1', name: 'Alice' })];
      const ledgers = [makeLedger({ id: 'L1', personId: 'P1', currency: 'INR' })];
      const entries = [
        makeEntry({ type: 'lent', amountMinor: 500000, ledgerId: 'L1', date: '2024-01-01' }),
        makeEntry({ type: 'repayment_received', amountMinor: 200000, ledgerId: 'L1', date: '2024-02-01' }),
      ];
      const dash = dashboardSummary(people, ledgers, entries);
      expect(dash.youWillReceive).toBe(300000);
      expect(dash.youOwe).toBe(0);
      expect(dash.people).toHaveLength(1);
    });
  });

  describe('recentEntries', () => {
    it('returns the N most recent active entries by date desc', () => {
      const entries = [
        makeEntry({ type: 'lent', amountMinor: 100, ledgerId: 'L', date: '2024-01-01' }),
        makeEntry({ type: 'lent', amountMinor: 200, ledgerId: 'L', date: '2024-03-01' }),
        makeEntry({ type: 'lent', amountMinor: 300, ledgerId: 'L', date: '2024-02-01' }),
        makeEntry({
          type: 'lent',
          amountMinor: 999,
          ledgerId: 'L',
          date: '2024-04-01',
          deletedAt: '2024-04-02T00:00:00.000Z',
        }),
      ];
      const recent = recentEntries(entries, 2);
      expect(recent.map((e) => e.amountMinor)).toEqual([200, 300]);
    });
  });

  describe('activeEntries', () => {
    it('filters out soft-deleted entries', () => {
      const entries = [
        makeEntry({ type: 'lent', amountMinor: 100, ledgerId: 'L', date: '2024-01-01' }),
        makeEntry({
          type: 'lent',
          amountMinor: 200,
          ledgerId: 'L',
          date: '2024-01-02',
          deletedAt: '2024-01-03T00:00:00.000Z',
        }),
      ];
      expect(activeEntries(entries)).toHaveLength(1);
    });
  });

  describe('sign helper integration', () => {
    it('matches the spec example from work.md §24', () => {
      // Lent Rahul +5,000; Rahul repaid -1,000; Lent Rahul +2,000 -> Rahul owes 6,000
      const entries = [
        makeEntry({ type: 'lent', amountMinor: 500000, ledgerId: 'L', date: '2024-08-13' }),
        makeEntry({ type: 'repayment_received', amountMinor: 100000, ledgerId: 'L', date: '2024-08-14' }),
        makeEntry({ type: 'lent', amountMinor: 200000, ledgerId: 'L', date: '2024-08-15' }),
      ];
      const total = entries.map(entryToSignedAmount).reduce((a, b) => a + b, 0);
      expect(total).toBe(600000);
    });
  });
});
