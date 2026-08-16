import { beforeEach, describe, expect, it } from 'vitest';
import { freshDB, wipeDB } from '@/tests/db-test-utils';
import { personRepository } from '@shared/people/repository';
import { settingsRepository } from '@shared/settings/repository';
import { lendLedgerRepository } from './lendLedgerRepository';

describe('Lend archived ledgers', () => {
  beforeEach(async () => {
    await wipeDB();
    freshDB();
    await settingsRepository.get();
  });

  it('excludes archived ledgers from active lists and creates a fresh quick-entry ledger', async () => {
    const person = await personRepository.create({ name: 'Rahul' });
    const archived = await lendLedgerRepository.getOrCreate(person.id, 'INR');

    await lendLedgerRepository.archive(archived.id);

    expect(await lendLedgerRepository.list()).toEqual([]);
    expect(await lendLedgerRepository.listForPerson(person.id)).toEqual([]);

    const replacement = await lendLedgerRepository.getOrCreate(person.id, 'INR');
    expect(replacement.id).not.toBe(archived.id);
    expect(replacement.archived).toBe(false);
  });
});
