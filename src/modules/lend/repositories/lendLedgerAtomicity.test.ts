import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDB, wipeDB } from '@tests/db-test-utils';
import { getDB } from '@db/database';
import { personRepository } from '@shared/people/repository';
import { settingsRepository } from '@shared/settings/repository';
import { lendEntryRepository } from './lendEntryRepository';
import { lendLedgerRepository } from './lendLedgerRepository';

beforeEach(async () => {
  await wipeDB();
  freshDB();
  await settingsRepository.get();
});

describe('Lend ledger cascade atomicity', () => {
  it('rolls back the ledger delete if an entry update fails', async () => {
    const person = await personRepository.create({ name: 'Rahul' });
    const ledger = await lendLedgerRepository.create({ personId: person.id, currency: 'INR' });
    const entry = await lendEntryRepository.create({
      ledgerId: ledger.id,
      type: 'lent',
      amountMinor: 5000,
      date: '2026-08-18',
    });
    const db = getDB();
    const putSpy = vi
      .spyOn(db.lendEntries, 'put')
      .mockRejectedValueOnce(new Error('simulated entry write failure'));

    await expect(lendLedgerRepository.softDelete(ledger.id)).rejects.toThrow(
      'simulated entry write failure',
    );
    putSpy.mockRestore();

    expect((await db.lendLedgers.get(ledger.id))?.deletedAt).toBeUndefined();
    expect((await db.lendEntries.get(entry.id))?.deletedAt).toBeUndefined();
  });
});
