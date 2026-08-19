import { beforeEach, describe, expect, it } from 'vitest';
import { freshDB, wipeDB } from '@tests/db-test-utils';
import { getDB } from '@db/database';
import { personRepository } from '@shared/people/repository';
import { lendEntryRepository } from '@modules/lend/repositories/lendEntryRepository';
import { lendLedgerRepository } from '@modules/lend/repositories/lendLedgerRepository';
import { splitGroupRepository } from '@modules/split/repositories/splitGroupRepository';
import { settingsRepository } from './repository';

beforeEach(async () => {
  await wipeDB();
  freshDB();
  await settingsRepository.get();
});

describe('settingsRepository.setDefaultCurrency', () => {
  it('does not lock Main currency for empty Split groups or empty Lend ledgers', async () => {
    const person = await personRepository.create({ name: 'Rahul' });
    await splitGroupRepository.create({ name: 'Trip', currency: 'EUR' });
    await lendLedgerRepository.create({ personId: person.id, currency: 'INR' });

    const updated = await settingsRepository.setDefaultCurrency('USD');
    expect(updated.defaultCurrency).toBe('USD');
  });

  it('locks Main currency after a Lend entry is recorded', async () => {
    const person = await personRepository.create({ name: 'Rahul' });
    const ledger = await lendLedgerRepository.getOrCreate(person.id, 'INR');
    await lendEntryRepository.create({
      ledgerId: ledger.id,
      type: 'lent',
      amountMinor: 1000,
      date: '2026-08-19',
    });

    await expect(settingsRepository.setDefaultCurrency('USD')).rejects.toThrow(/locked/);
    expect((await getDB().settings.get('app'))?.defaultCurrency).toBe('INR');
  });
});
