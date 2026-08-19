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
import { SELF_PERSON_ID } from '@db/seed';

const timestamp = '2026-08-17T00:00:00.000Z';
const entity = { createdAt: timestamp, updatedAt: timestamp, revision: 1 };

function validEmptyBackup() {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: timestamp,
    appVersion: 'test',
    shared: {
      people: [{ id: SELF_PERSON_ID, name: 'Me', isSelf: true, ...entity }],
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

  it('exports an empty financial backup with the required self identity', async () => {
    const backup = await exportBackup();
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.shared.people).toHaveLength(1);
    expect(backup.shared.people[0]).toMatchObject({ id: SELF_PERSON_ID, isSelf: true });
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

  it('validateBackup accepts a well-formed empty financial backup', () => {
    expect(() => validateBackup(validEmptyBackup())).not.toThrow();
  });

  it('validateBackup requires exactly one active self person', () => {
    const backup = validEmptyBackup();
    backup.shared.people = [];
    expect(() => validateBackup(backup)).toThrow(/self person/);
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
            ...entity,
          },
        ],
      },
    };

    expect(() => validateBackup(malformed)).toThrow('track.transactions.0.amountMinor');
  });

  it('validateBackup rejects impossible calendar dates', () => {
    const backup = validEmptyBackup();
    backup.track.transactions.push({
      id: 't1',
      type: 'expense',
      title: 'Coffee',
      amountMinor: 15000,
      currency: 'INR',
      date: '2026-02-30',
      ...entity,
    });
    expect(() => validateBackup(backup)).toThrow(/calendar date/);
  });

  it('validateBackup rejects dangling Lend entries', () => {
    const backup = validEmptyBackup();
    backup.lend.entries.push({
      id: 'e1',
      ledgerId: 'missing-ledger',
      type: 'lent',
      amountMinor: 5000,
      date: '2026-08-17',
      ...entity,
    });
    expect(() => validateBackup(backup)).toThrow(/ledger does not exist/);
  });

  it('validateBackup rejects Split expenses whose payer totals do not match', () => {
    const backup = validEmptyBackup();
    backup.split.groups.push({
      id: 'g1',
      name: 'Trip',
      currency: 'INR',
      archived: false,
      ...entity,
    });
    backup.split.expenses.push({
      id: 'x1',
      groupId: 'g1',
      title: 'Dinner',
      amountMinor: 10000,
      currency: 'INR',
      date: '2026-08-17',
      splitMethod: 'exact',
      ...entity,
    });
    backup.split.payers.push({
      id: 'pay1',
      expenseId: 'x1',
      personId: SELF_PERSON_ID,
      amountMinor: 5000,
      ...entity,
    });
    backup.split.shares.push({
      id: 'share1',
      expenseId: 'x1',
      personId: SELF_PERSON_ID,
      amountMinor: 10000,
      ...entity,
    });
    expect(() => validateBackup(backup)).toThrow(/payer totals/);
  });

  it('round-trips financial records and the default currency', async () => {
    const db = getDB();
    await settingsRepository.update({ defaultCurrency: 'USD' });
    await db.people.put({
      id: 'p1',
      name: 'Rahul',
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
    });
    await db.trackTransactions.put({
      id: 't1',
      type: 'expense',
      title: 'Coffee',
      amountMinor: 15000,
      currency: 'USD',
      date: '2026-08-13',
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
    });

    const backup = await exportBackup();
    expect(backup.shared.people).toHaveLength(2);
    expect(backup.shared.settings.defaultCurrency).toBe('USD');

    await db.people.clear();
    await db.trackTransactions.clear();
    await db.settings.clear();
    await settingsRepository.get();
    expect((await db.settings.get('app'))?.defaultCurrency).toBe('INR');

    await restoreBackup(validateBackup(backup));

    expect(await db.people.toArray()).toHaveLength(2);
    expect(await db.trackTransactions.toArray()).toHaveLength(1);
    expect((await db.settings.get('app'))?.defaultCurrency).toBe('USD');
  });

  it('summarizeBackup reports counts', async () => {
    const db = getDB();
    await db.people.put({ id: 'p1', name: 'A', createdAt: '', updatedAt: '', revision: 1 });
    const backup = await exportBackup();
    const summary = summarizeBackup(backup);
    expect(summary.people).toBe(2);
  });
});
