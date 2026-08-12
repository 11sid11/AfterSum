/**
 * Split repository tests.
 *
 * Covers:
 *   - basic CRUD for each entity
 *   - soft delete + restore
 *   - atomic expense creation (work.md §35)
 *   - the critical isolation test (work.md §85): a Split
 *     settlement must not alter Lend.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB, wipeDB } from '@tests/db-test-utils';
import { splitGroupRepository } from './splitGroupRepository';
import { splitGroupMemberRepository } from './splitGroupMemberRepository';
import { splitExpenseRepository } from './splitExpenseRepository';
import { splitPayerRepository } from './splitPayerRepository';
import { splitShareRepository } from './splitShareRepository';
import { splitSettlementRepository } from './splitSettlementRepository';
import { personRepository } from '@shared/people/repository';
import { settingsRepository } from '@shared/settings/repository';
import { SELF_PERSON_ID } from '@db/seed';

beforeEach(async () => {
  await wipeDB();
  freshDB();
  await settingsRepository.get();
});

describe('splitGroupRepository', () => {
  it('create + list returns the new group', async () => {
    const g = await splitGroupRepository.create({
      name: 'Goa',
      currency: 'INR',
    });
    const list = await splitGroupRepository.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(g.id);
    expect(list[0]?.name).toBe('Goa');
  });

  it('archive hides the group from listActive', async () => {
    const g = await splitGroupRepository.create({ name: 'X', currency: 'INR' });
    await splitGroupRepository.archive(g.id);
    expect(await splitGroupRepository.listActive()).toHaveLength(0);
    expect(await splitGroupRepository.list()).toHaveLength(1);
  });

  it('softDelete + restore round-trip', async () => {
    const g = await splitGroupRepository.create({ name: 'X', currency: 'INR' });
    await splitGroupRepository.softDelete(g.id);
    expect((await splitGroupRepository.list()).some((x) => x.id === g.id)).toBe(false);
    await splitGroupRepository.restore(g.id);
    expect((await splitGroupRepository.list()).some((x) => x.id === g.id)).toBe(true);
  });
});

describe('splitGroupMemberRepository', () => {
  it('getOrCreate is idempotent', async () => {
    const g = await splitGroupRepository.create({ name: 'X', currency: 'INR' });
    const m1 = await splitGroupMemberRepository.getOrCreate(g.id, 'p1');
    const m2 = await splitGroupMemberRepository.getOrCreate(g.id, 'p1');
    expect(m1.id).toBe(m2.id);
    expect(m1.active).toBe(true);
  });

  it('replaceAllForGroup activates new and deactivates old', async () => {
    const g = await splitGroupRepository.create({ name: 'X', currency: 'INR' });
    await splitGroupMemberRepository.getOrCreate(g.id, 'a');
    await splitGroupMemberRepository.getOrCreate(g.id, 'b');
    await splitGroupMemberRepository.getOrCreate(g.id, 'c');

    await splitGroupMemberRepository.replaceAllForGroup(g.id, ['a', 'c']);
    const members = await splitGroupMemberRepository.listForGroup(g.id);
    const byPerson = Object.fromEntries(members.map((m) => [m.personId, m.active]));
    expect(byPerson.a).toBe(true);
    expect(byPerson.c).toBe(true);
    expect(byPerson.b).toBe(false);
  });
});

describe('splitExpenseRepository.createAtomic', () => {
  it('writes expense + payers + shares together', async () => {
    const g = await splitGroupRepository.create({ name: 'X', currency: 'INR' });
    const result = await splitExpenseRepository.createAtomic({
      groupId: g.id,
      title: 'Dinner',
      amountMinor: 1000,
      currency: 'INR',
      date: '2024-01-15',
      splitMethod: 'equal',
      payers: [{ personId: 'a', amountMinor: 1000 }],
      participantIds: ['a', 'b', 'c'],
      allocation: { method: 'equal' },
    });
    expect(result.expense.amountMinor).toBe(1000);
    expect(result.payers).toHaveLength(1);
    expect(result.shares).toHaveLength(3);
    const sumShares = result.shares.reduce((s, x) => s + x.amountMinor, 0);
    expect(sumShares).toBe(1000);
  });

  it('rollback: invalid shares leave no rows', async () => {
    const g = await splitGroupRepository.create({ name: 'X', currency: 'INR' });
    // Exact share that does NOT sum to the total — the
    // service must throw and Dexie must roll back.
    await expect(
      splitExpenseRepository.createAtomic({
        groupId: g.id,
        title: 'Bad',
        amountMinor: 1000,
        currency: 'INR',
        date: '2024-01-15',
        splitMethod: 'exact',
        payers: [{ personId: 'a', amountMinor: 1000 }],
        participantIds: ['a', 'b'],
        allocation: { method: 'exact', amountsByPersonId: { a: 500, b: 400 } },
      }),
    ).rejects.toThrow();

    const expenses = await splitExpenseRepository.listForGroup(g.id);
    expect(expenses).toHaveLength(0);
    const payers = await splitPayerRepository.listForGroup(g.id);
    expect(payers).toHaveLength(0);
    const shares = await splitShareRepository.listForGroup(g.id);
    expect(shares).toHaveLength(0);
  });

  it('softDelete + restore round-trip', async () => {
    const g = await splitGroupRepository.create({ name: 'X', currency: 'INR' });
    const { expense } = await splitExpenseRepository.createAtomic({
      groupId: g.id,
      title: 'X',
      amountMinor: 100,
      currency: 'INR',
      date: '2024-01-15',
      splitMethod: 'equal',
      payers: [{ personId: 'a', amountMinor: 100 }],
      participantIds: ['a'],
      allocation: { method: 'equal' },
    });
    await splitExpenseRepository.softDelete(expense.id);
    expect(await splitExpenseRepository.listForGroup(g.id)).toHaveLength(0);
    await splitExpenseRepository.restore(expense.id);
    expect(await splitExpenseRepository.listForGroup(g.id)).toHaveLength(1);
  });
});

describe('splitSettlementRepository', () => {
  it('rejects amountMinor = 0', async () => {
    const g = await splitGroupRepository.create({ name: 'X', currency: 'INR' });
    await expect(
      splitSettlementRepository.create({
        groupId: g.id,
        fromPersonId: 'a',
        toPersonId: 'b',
        amountMinor: 0,
        currency: 'INR',
        date: '2024-01-15',
      }),
    ).rejects.toThrow();
  });

  it('rejects from === to', async () => {
    const g = await splitGroupRepository.create({ name: 'X', currency: 'INR' });
    await expect(
      splitSettlementRepository.create({
        groupId: g.id,
        fromPersonId: 'a',
        toPersonId: 'a',
        amountMinor: 100,
        currency: 'INR',
        date: '2024-01-15',
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Critical isolation test (work.md §85)
//
// Spec: a Split settlement must NOT alter Lend.
// The Split module is independent from Lend. The
// repositories never write to lendEntries, so this is
// guaranteed by the data-flow design — but we assert it
// here as a permanent regression test.
// ---------------------------------------------------------------------------

describe('work.md §85: Split settlement must not affect Lend', () => {
  // We need a tiny "Lend writer" that bypasses the Split
  // module entirely. We use the same Dexie singleton but
  // write directly to the lendEntries table to keep the
  // test self-contained. The test would still pass if the
  // Split module later adds cross-table logic by accident.

  it('does not change the Lend ledger state', async () => {
    const db = freshDB();
    const me = await personRepository.ensureSelf();
    expect(me.id).toBe(SELF_PERSON_ID);

    // Seed a Lend entry for Rahul (independent of Split).
    const ledger = { id: 'l1', personId: 'rahul', currency: 'INR', archived: false, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', revision: 1 } as const;
    await db.lendLedgers.put(ledger);
    const entry = {
      id: 'le1',
      ledgerId: 'l1',
      type: 'lent' as const,
      amountMinor: 5000,
      date: '2024-01-10',
      createdAt: '2024-01-10T00:00:00.000Z',
      updatedAt: '2024-01-10T00:00:00.000Z',
      revision: 1,
    };
    await db.lendEntries.put(entry);

    // Snapshot Lend state.
    const lendBefore = await db.lendEntries.toArray();
    expect(lendBefore).toHaveLength(1);
    expect(lendBefore[0]?.amountMinor).toBe(5000);

    // Now seed Split groups + perform a Split settlement.
    const goa = await splitGroupRepository.create({ name: 'Goa', currency: 'INR' });
    const delhi = await splitGroupRepository.create({ name: 'Delhi', currency: 'INR' });
    await splitGroupMemberRepository.getOrCreate(goa.id, me.id);
    await splitGroupMemberRepository.getOrCreate(goa.id, 'rahul');
    await splitGroupMemberRepository.getOrCreate(delhi.id, me.id);
    await splitGroupMemberRepository.getOrCreate(delhi.id, 'rahul');

    await splitExpenseRepository.createAtomic({
      groupId: goa.id,
      title: 'Goa expense',
      amountMinor: 1200,
      currency: 'INR',
      date: '2024-01-12',
      splitMethod: 'equal',
      payers: [{ personId: me.id, amountMinor: 1200 }],
      participantIds: [me.id, 'rahul'],
      allocation: { method: 'equal' },
    });

    await splitExpenseRepository.createAtomic({
      groupId: delhi.id,
      title: 'Delhi expense',
      amountMinor: 1200,
      currency: 'INR',
      date: '2024-01-13',
      splitMethod: 'equal',
      payers: [{ personId: 'rahul', amountMinor: 1200 }],
      participantIds: [me.id, 'rahul'],
      allocation: { method: 'equal' },
    });

    // Settle Goa: rahul pays me 600.
    await splitSettlementRepository.create({
      groupId: goa.id,
      fromPersonId: 'rahul',
      toPersonId: me.id,
      amountMinor: 600,
      currency: 'INR',
      date: '2024-01-14',
    });

    // Lend state must be UNCHANGED.
    const lendAfter = await db.lendEntries.toArray();
    expect(lendAfter).toHaveLength(1);
    expect(lendAfter[0]?.amountMinor).toBe(5000);
    expect(lendAfter[0]?.id).toBe('le1');
  });
});
