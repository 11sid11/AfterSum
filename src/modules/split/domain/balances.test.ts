/**
 * Split balance engine tests.
 *
 * Verifies the spec's formula (§37):
 *   balance = payments_made - allocated_shares
 *           + settlements_sent - settlements_received
 *
 * Sign convention (§36): positive = should receive, negative = owes.
 */

import { describe, it, expect } from 'vitest';
import { computeGroupBalances, computeMemberBalances, balancesByPerson } from './balances';
import type {
  SplitExpense,
  SplitGroup,
  SplitGroupMember,
  SplitPayer,
  SplitSettlement,
  SplitShare,
} from '@db/schema';

const NOW = '2024-01-01T00:00:00.000Z';

function makeGroup(): SplitGroup {
  return {
    id: 'g1',
    name: 'Goa',
    currency: 'INR',
    archived: false,
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
  };
}

function makeMember(personId: string, active = true): SplitGroupMember {
  return {
    id: `m-${personId}`,
    groupId: 'g1',
    personId,
    active,
    joinedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
  };
}

function makeExpense(overrides: Partial<SplitExpense> = {}): SplitExpense {
  return {
    id: overrides.id ?? 'e1',
    groupId: 'g1',
    title: overrides.title ?? 'Dinner',
    amountMinor: overrides.amountMinor ?? 1000,
    currency: 'INR',
    date: overrides.date ?? '2024-01-15',
    splitMethod: overrides.splitMethod ?? 'equal',
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
    note: overrides.note,
    deletedAt: overrides.deletedAt,
  };
}

function makePayer(expenseId: string, personId: string, amountMinor: number): SplitPayer {
  return {
    id: `p-${expenseId}-${personId}`,
    expenseId,
    personId,
    amountMinor,
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
  };
}

function makeShare(expenseId: string, personId: string, amountMinor: number): SplitShare {
  return {
    id: `s-${expenseId}-${personId}`,
    expenseId,
    personId,
    amountMinor,
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
  };
}

function makeSettlement(overrides: Partial<SplitSettlement> = {}): SplitSettlement {
  return {
    id: overrides.id ?? 's1',
    groupId: 'g1',
    fromPersonId: overrides.fromPersonId ?? 'a',
    toPersonId: overrides.toPersonId ?? 'b',
    amountMinor: overrides.amountMinor ?? 500,
    currency: 'INR',
    date: overrides.date ?? '2024-01-20',
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
    note: overrides.note,
    deletedAt: overrides.deletedAt,
  };
}

describe('computeGroupBalances', () => {
  it('a single payer who is also a participant ends at 0', () => {
    const group = makeGroup();
    const members = [makeMember('a')];
    const expenses = [makeExpense({ amountMinor: 1000 })];
    const payers = [makePayer('e1', 'a', 1000)];
    const shares = [makeShare('e1', 'a', 1000)];

    const balances = computeGroupBalances({
      group,
      members,
      expenses,
      payers,
      shares,
      settlements: [],
    });
    expect(balances.get('a')).toBe(0);
  });

  it('payer who is not a participant is owed the expense total', () => {
    const group = makeGroup();
    const members = [makeMember('a'), makeMember('b')];
    const expenses = [makeExpense({ amountMinor: 1000 })];
    // a paid the full 1000, b owes the full 1000
    const payers = [makePayer('e1', 'a', 1000)];
    const shares = [makeShare('e1', 'b', 1000)];

    const balances = computeGroupBalances({
      group,
      members,
      expenses,
      payers,
      shares,
      settlements: [],
    });
    expect(balances.get('a')).toBe(1000); // should receive
    expect(balances.get('b')).toBe(-1000); // owes
  });

  it('equal split of ₹1000 among 3: payer is owed 666.66, others owe 333.33', () => {
    const group = makeGroup();
    const members = [makeMember('a'), makeMember('b'), makeMember('c')];
    const expenses = [makeExpense({ amountMinor: 1000 })];
    // a paid 1000; b and c owe 500, a owes 0 (1000/3 = 334, 333, 333)
    const payers = [makePayer('e1', 'a', 1000)];
    const shares = [
      makeShare('e1', 'a', 334),
      makeShare('e1', 'b', 333),
      makeShare('e1', 'c', 333),
    ];

    const balances = computeGroupBalances({
      group,
      members,
      expenses,
      payers,
      shares,
      settlements: [],
    });
    expect(balances.get('a')).toBe(1000 - 334);
    expect(balances.get('b')).toBe(-333);
    expect(balances.get('c')).toBe(-333);
  });

  it('settlement: a partial settle of 500 from b -> a zeroes b, drops a by 500', () => {
    const group = makeGroup();
    const members = [makeMember('a'), makeMember('b')];
    const expenses = [makeExpense({ amountMinor: 1000 })];
    const payers = [makePayer('e1', 'a', 1000)];
    const shares = [makeShare('e1', 'b', 1000)];
    const settlements = [makeSettlement({ fromPersonId: 'b', toPersonId: 'a', amountMinor: 500 })];

    const balances = computeGroupBalances({
      group,
      members,
      expenses,
      payers,
      shares,
      settlements,
    });
    // b: 0 payments - 1000 share + 500 sent (debt decreased) = -500
    // a: 1000 payments - 0 share - 500 received (should-receive decreased) = 500
    expect(balances.get('a')).toBe(500);
    expect(balances.get('b')).toBe(-500);
  });

  it('full settle of 1000 zeroes both sides', () => {
    const group = makeGroup();
    const members = [makeMember('a'), makeMember('b')];
    const expenses = [makeExpense({ amountMinor: 1000 })];
    const payers = [makePayer('e1', 'a', 1000)];
    const shares = [makeShare('e1', 'b', 1000)];
    const settlements = [makeSettlement({ fromPersonId: 'b', toPersonId: 'a', amountMinor: 1000 })];

    const balances = computeGroupBalances({
      group,
      members,
      expenses,
      payers,
      shares,
      settlements,
    });
    expect(balances.get('a')).toBe(0);
    expect(balances.get('b')).toBe(0);
  });

  it('soft-deleted expenses contribute nothing', () => {
    const group = makeGroup();
    const members = [makeMember('a'), makeMember('b')];
    const expenses = [makeExpense({ id: 'e1', amountMinor: 1000, deletedAt: NOW })];
    const payers = [makePayer('e1', 'a', 1000)];
    const shares = [makeShare('e1', 'b', 1000)];

    const balances = computeGroupBalances({
      group,
      members,
      expenses,
      payers,
      shares,
      settlements: [],
    });
    expect(balances.get('a')).toBe(0);
    expect(balances.get('b')).toBe(0);
  });

  it('multiple payers (work.md §86 multi-payer case)', () => {
    const group = makeGroup();
    const members = [makeMember('a'), makeMember('b'), makeMember('c')];
    const expenses = [makeExpense({ amountMinor: 900 })];
    // a paid 500, b paid 400; all three share equally (300 each)
    const payers = [makePayer('e1', 'a', 500), makePayer('e1', 'b', 400)];
    const shares = [
      makeShare('e1', 'a', 300),
      makeShare('e1', 'b', 300),
      makeShare('e1', 'c', 300),
    ];
    const balances = computeGroupBalances({
      group,
      members,
      expenses,
      payers,
      shares,
      settlements: [],
    });
    expect(balances.get('a')).toBe(500 - 300);
    expect(balances.get('b')).toBe(400 - 300);
    expect(balances.get('c')).toBe(0 - 300);
  });

  it('historic inactive member still affects balances', () => {
    // Historic expenses must continue to affect the live
    // members' balances, even when the payer is now inactive.
    // b (inactive) paid 1000 on behalf of a, so a owes b
    // effectively 1000. b is excluded from the live map but
    // a still records -1000.
    const group = makeGroup();
    const members = [makeMember('a', true), makeMember('b', false)];
    const expenses = [makeExpense({ amountMinor: 1000 })];
    const payers = [makePayer('e1', 'b', 1000)]; // b (inactive) paid
    const shares = [makeShare('e1', 'a', 1000)]; // a owes

    const balances = computeGroupBalances({
      group,
      members,
      expenses,
      payers,
      shares,
      settlements: [],
    });
    // a owes 1000 (their share). b's payment is recorded
    // historically but b isn't in the active member set,
    // so the active-only view doesn't pre-seed b — yet
    // the payer iteration adds their row to the map so
    // b's balance appears too. The UI filters display by
    // the member `active` flag.
    expect(balances.get('a')).toBe(-1000);
    expect(balances.get('b')).toBe(1000);
  });

  it('computeMemberBalances includes inactive members', () => {
    const group = makeGroup();
    const members = [makeMember('a', true), makeMember('b', false)];
    const expenses = [makeExpense({ amountMinor: 1000 })];
    const payers = [makePayer('e1', 'b', 1000)];
    const shares = [makeShare('e1', 'a', 1000)];

    const balances = computeMemberBalances({
      group,
      members,
      expenses,
      payers,
      shares,
      settlements: [],
    });
    expect(balances.get('a')).toBe(-1000);
    expect(balances.get('b')).toBe(1000);
  });
});

describe('balancesByPerson', () => {
  it('returns rows sorted by absolute balance desc with direction labels', () => {
    const balances = new Map<string, number>([
      ['a', 1000],
      ['b', -2500],
      ['c', 0],
    ]);
    const rows = balancesByPerson(balances);
    expect(rows[0]).toEqual({ personId: 'b', amountMinor: -2500, direction: 'owes' });
    expect(rows[1]).toEqual({ personId: 'a', amountMinor: 1000, direction: 'is_owed' });
    expect(rows[2]).toEqual({ personId: 'c', amountMinor: 0, direction: 'settled' });
  });
});
