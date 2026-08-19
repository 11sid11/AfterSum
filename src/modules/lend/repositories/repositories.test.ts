/**
 * Lend repository tests.
 *
 * Covers create / list / softDelete / restore / getOrCreate
 * for both the ledger and entry repositories.
 *
 * Also includes the CRITICAL ISOLATION TEST from work.md
 * §85: a Split group settlement must NOT alter a Lend
 * ledger. This is a permanent regression test.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB, wipeDB } from '@/tests/db-test-utils';
import { getDB } from '@db/database';
import { lendLedgerRepository } from './lendLedgerRepository';
import { lendEntryRepository } from './lendEntryRepository';
import { personRepository } from '@shared/people/repository';
import { settingsRepository } from '@shared/settings/repository';
import { ledgerBalance, personBalanceFromLedgers } from '../domain/balance';
import { SELF_PERSON_ID } from '@db/seed';

async function seedPerson(name: string) {
  return personRepository.create({ name });
}

beforeEach(async () => {
  await wipeDB();
  freshDB();
  await settingsRepository.get();
});

describe('LendLedgerRepository', () => {
  it('list returns active ledgers sorted by createdAt', async () => {
    const rahul = await seedPerson('Rahul');
    const priya = await seedPerson('Priya');
    const a = await lendLedgerRepository.create({ personId: rahul.id, currency: 'INR' });
    const b = await lendLedgerRepository.create({ personId: priya.id, currency: 'INR' });
    const list = await lendLedgerRepository.list();
    expect(list.map((ledger) => ledger.id)).toEqual([a.id, b.id]);
  });

  it('getOrCreate is idempotent and rejects non-Main currencies', async () => {
    const person = await seedPerson('Rahul');
    const first = await lendLedgerRepository.getOrCreate(person.id, 'INR');
    const second = await lendLedgerRepository.getOrCreate(person.id, 'INR');
    expect(first.id).toBe(second.id);
    await expect(lendLedgerRepository.getOrCreate(person.id, 'USD')).rejects.toThrow(/Main currency/);
  });

  it('softDelete then restore round-trips', async () => {
    const person = await seedPerson('Rahul');
    const ledger = await lendLedgerRepository.create({ personId: person.id, currency: 'INR' });
    await lendEntryRepository.create({
      ledgerId: ledger.id,
      type: 'lent',
      amountMinor: 100000,
      date: '2024-01-01',
    });
    await lendLedgerRepository.softDelete(ledger.id);
    let list = await lendLedgerRepository.list();
    expect(list).toHaveLength(0);
    const entryList = await lendEntryRepository.list();
    expect(entryList.every((e) => !!e.deletedAt)).toBe(true);

    await lendLedgerRepository.restore(ledger.id);
    list = await lendLedgerRepository.list();
    expect(list).toHaveLength(1);
    const after = await lendEntryRepository.list();
    expect(after.every((e) => !e.deletedAt)).toBe(true);
  });
});

describe('LendEntryRepository', () => {
  it('create enforces validation (zero amount rejected)', async () => {
    const person = await seedPerson('Rahul');
    const ledger = await lendLedgerRepository.getOrCreate(person.id, 'INR');
    await expect(
      lendEntryRepository.create({
        ledgerId: ledger.id,
        type: 'lent',
        amountMinor: 0,
        date: '2024-01-01',
      }),
    ).rejects.toThrow();
  });

  it('create stores magnitude for non-adjustment and signed for adjustment', async () => {
    const person = await seedPerson('Rahul');
    const ledger = await lendLedgerRepository.getOrCreate(person.id, 'INR');
    const lent = await lendEntryRepository.create({
      ledgerId: ledger.id,
      type: 'lent',
      amountMinor: 5000,
      date: '2024-01-01',
    });
    expect(lent.amountMinor).toBe(5000);
    const adj = await lendEntryRepository.create({
      ledgerId: ledger.id,
      type: 'adjustment',
      amountMinor: -1234,
      date: '2024-01-02',
    });
    expect(adj.amountMinor).toBe(-1234);
  });

  it('rejects negative amount for non-adjustment entries', async () => {
    const person = await seedPerson('Rahul');
    const ledger = await lendLedgerRepository.getOrCreate(person.id, 'INR');
    await expect(
      lendEntryRepository.create({
        ledgerId: ledger.id,
        type: 'lent',
        amountMinor: -5000,
        date: '2024-01-01',
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid calendar date', async () => {
    const person = await seedPerson('Rahul');
    const ledger = await lendLedgerRepository.getOrCreate(person.id, 'INR');
    await expect(
      lendEntryRepository.create({
        ledgerId: ledger.id,
        type: 'lent',
        amountMinor: 5000,
        date: '2024-02-30',
      }),
    ).rejects.toThrow();
  });

  it('rejects an update that would leave a negative non-adjustment amount', async () => {
    const person = await seedPerson('Rahul');
    const ledger = await lendLedgerRepository.getOrCreate(person.id, 'INR');
    const entry = await lendEntryRepository.create({
      ledgerId: ledger.id,
      type: 'adjustment',
      amountMinor: -5000,
      date: '2024-01-01',
    });

    await expect(lendEntryRepository.update(entry.id, { type: 'lent' })).rejects.toThrow(/positive/);
    expect((await lendEntryRepository.get(entry.id))?.type).toBe('adjustment');
  });

  it('can explicitly clear note and due date', async () => {
    const person = await seedPerson('Rahul');
    const ledger = await lendLedgerRepository.getOrCreate(person.id, 'INR');
    const entry = await lendEntryRepository.create({
      ledgerId: ledger.id,
      type: 'lent',
      amountMinor: 5000,
      date: '2024-01-01',
      dueDate: '2024-02-01',
      note: 'Reminder',
    });

    const updated = await lendEntryRepository.update(entry.id, { dueDate: '', note: '' });
    expect(updated.dueDate).toBeUndefined();
    expect(updated.note).toBeUndefined();
  });

  it('softDelete then restore round-trips an entry', async () => {
    const person = await seedPerson('Rahul');
    const ledger = await lendLedgerRepository.getOrCreate(person.id, 'INR');
    const entry = await lendEntryRepository.create({
      ledgerId: ledger.id,
      type: 'lent',
      amountMinor: 5000,
      date: '2024-01-01',
    });
    await lendEntryRepository.softDelete(entry.id);
    let after = await lendEntryRepository.listForLedger(ledger.id);
    expect(after).toHaveLength(0);
    await lendEntryRepository.restore(entry.id);
    after = await lendEntryRepository.listForLedger(ledger.id);
    expect(after).toHaveLength(1);
  });
});

describe('Critical isolation: Split settlement must not alter Lend (work.md §85)', () => {
  it('keeps Lend balances intact after a Split settlement', async () => {
    const rahul = await personRepository.create({ name: 'Rahul' });
    const me = await personRepository.ensureSelf();

    const lendLedger = await lendLedgerRepository.getOrCreate(rahul.id, 'INR');
    await lendEntryRepository.create({
      ledgerId: lendLedger.id,
      type: 'lent',
      amountMinor: 500000,
      date: '2024-01-01',
    });

    const db = getDB();
    const goaId = 'goa-group';
    const now = new Date().toISOString();
    await db.splitGroups.put({
      id: goaId,
      name: 'Goa',
      currency: 'INR',
      archived: false,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    });
    for (const pid of [me.id, rahul.id]) {
      await db.splitGroupMembers.put({
        id: `m-${pid}-${goaId}`,
        groupId: goaId,
        personId: pid,
        active: true,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      });
    }
    await db.splitExpenses.put({
      id: 'goa-exp-1',
      groupId: goaId,
      title: 'Dinner',
      amountMinor: 120000,
      currency: 'INR',
      date: '2024-01-02',
      splitMethod: 'equal',
      createdAt: now,
      updatedAt: now,
      revision: 1,
    });
    await db.splitPayers.bulkPut([
      {
        id: 'p-me',
        expenseId: 'goa-exp-1',
        personId: me.id,
        amountMinor: 120000,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
    ]);
    await db.splitShares.bulkPut([
      {
        id: 's-me',
        expenseId: 'goa-exp-1',
        personId: me.id,
        amountMinor: 60000,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
      {
        id: 's-rahul',
        expenseId: 'goa-exp-1',
        personId: rahul.id,
        amountMinor: 60000,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
    ]);
    void SELF_PERSON_ID;

    const lendLedgers = await lendLedgerRepository.list();
    const lendEntries = await lendEntryRepository.list();
    const lendBalanceBefore = personBalanceFromLedgers(lendLedgers, lendEntries, rahul.id);
    expect(lendBalanceBefore).toBe(500000);

    await db.splitSettlements.put({
      id: 'settle-1',
      groupId: goaId,
      fromPersonId: rahul.id,
      toPersonId: me.id,
      amountMinor: 60000,
      currency: 'INR',
      date: '2024-01-03',
      createdAt: now,
      updatedAt: now,
      revision: 1,
    });

    const lendLedgersAfter = await lendLedgerRepository.list();
    const lendEntriesAfter = await lendEntryRepository.list();
    const lendBalanceAfter = personBalanceFromLedgers(
      lendLedgersAfter,
      lendEntriesAfter,
      rahul.id,
    );
    expect(lendBalanceAfter).toBe(500000);
    expect(ledgerBalance(lendEntriesAfter)).toBe(500000);

    const splitSettlements = await db.splitSettlements.toArray();
    expect(splitSettlements).toHaveLength(1);
    const lendSettlementLike = lendEntriesAfter.filter(
      (e) => e.note?.toLowerCase().includes('settle') ?? false,
    );
    expect(lendSettlementLike).toHaveLength(0);
  });
});
