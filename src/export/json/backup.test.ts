import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB, wipeDB } from '../../tests/db-test-utils';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  exportBackup,
  restoreBackup,
  summarizeBackup,
  validateBackup,
} from './backup';
import { getDB } from '@db/database';
import { settingsRepository } from '@shared/settings/repository';

function validEmptyBackup() {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: '2026-08-17T00:00:00.000Z',
    appVersion: 'test',
    shared: {
      people: [],
      settings: { defaultCurrency: 'INR' },
    },
    track: { transactions: [], categories: [], budgets: [], recurringRules: [] },
    split: { groups: [], members: [], expenses: [], payers: [], shares: [], settlements: [] },
    lend: { ledgers: [], entries: [] },
  };
}

describe('JSON backup', () => {
  beforeEach(async () => {
    await wipeDB();
    freshDB();
  });

  it('exports an empty backup with the right shape and financial settings', async () => {
    const backup = await exportBackup();
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.shared.people).toEqual([]);
    expect(backup.shared.settings.defaultCurrency).toBe('INR');
    expect(backup.track.transactions).toEqual([]);
    expect(backup.split.expenses).toEqual([]);
    expect(backup.lend.entries).toEqual([]);
  });

  it('validateBackup rejects wrong format', () => {
    expect(() => validateBackup({ ...validEmptyBackup(), format: 'wrong' })).toThrow();
  });

  it('validateBackup rejects wrong schemaVersion', () => {
    expect(() => validateBackup({ ...validEmptyBackup(), schemaVersion: 999 })).toThrow();
  });

  it('validateBackup accepts a well-formed empty backup', () => {
    expect(() => validateBackup(validEmptyBackup())).not.toThrow();
  });

  it('validateBackup rejects malformed financial rows with a useful path', () => {
    const backup = validEmptyBackup();
    const malformed = {
      ...backup,
      track: {
        ...backup.track,
        transactions: [
          {
            id: 't1',
            type: 'expense',
            title: 'Coffee',
            amountMinor: '15000',
            currency: 'INR',
            date: '2026-08-13',
            createdAt: '',
            updatedAt: '',
            revision: 1,
          },
        ],
      },
    };

    expect(() => validateBackup(malformed)).toThrow('track.transactions.0.amountMinor');
  });

  it('round-trips financial records and the default currency', async () => {
    const db = getDB();
    await settingsRepository.update({ defaultCurrency: 'USD' });
    await db.people.put({
      id: 'p1',
      name: 'Rahul',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
      revision: 1,
    });
    await db.trackTransactions.put({
      id: 't1',
      type: 'expense',
      title: 'Coffee',
      amountMinor: 15000,
      currency: 'USD',
      date: '2026-08-13',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
      revision: 1,
    });

    const backup = await exportBackup();
    expect(backup.shared.people).toHaveLength(1);
    expect(backup.shared.settings.defaultCurrency).toBe('USD');

    await db.people.clear();
    await db.trackTransactions.clear();
    await db.settings.clear();
    await settingsRepository.get();
    expect((await db.settings.get('app'))?.defaultCurrency).toBe('INR');

    await restoreBackup(validateBackup(backup));

    expect(await db.people.toArray()).toHaveLength(1);
    expect(await db.trackTransactions.toArray()).toHaveLength(1);
    expect((await db.settings.get('app'))?.defaultCurrency).toBe('USD');
  });

  it('summarizeBackup reports counts', async () => {
    const db = getDB();
    await db.people.put({ id: 'p1', name: 'A', createdAt: '', updatedAt: '', revision: 1 });
    const backup = await exportBackup();
    const summary = summarizeBackup(backup);
    expect(summary.people).toBe(1);
  });
});
