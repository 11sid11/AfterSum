import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB, wipeDB } from '../../tests/db-test-utils';
import { exportBackup, validateBackup, restoreBackup, BACKUP_FORMAT, summarizeBackup } from './backup';
import { getDB } from '@db/database';

describe('JSON backup', () => {
  beforeEach(async () => {
    await wipeDB();
    freshDB();
  });

  it('exports an empty backup with the right shape', async () => {
    const b = await exportBackup();
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.schemaVersion).toBe(1);
    expect(b.shared.people).toEqual([]);
    expect(b.track.transactions).toEqual([]);
    expect(b.split.expenses).toEqual([]);
    expect(b.lend.entries).toEqual([]);
  });

  it('validateBackup rejects wrong format', () => {
    expect(() => validateBackup({ format: 'wrong', schemaVersion: 1 })).toThrow();
  });

  it('validateBackup rejects wrong schemaVersion', () => {
    expect(() =>
      validateBackup({
        format: BACKUP_FORMAT,
        schemaVersion: 999,
        shared: { people: [] },
        track: { transactions: [], categories: [], budgets: [], recurringRules: [] },
        split: { groups: [], members: [], expenses: [], payers: [], shares: [], settlements: [] },
        lend: { ledgers: [], entries: [] },
      }),
    ).toThrow();
  });

  it('validateBackup accepts a well-formed empty backup', () => {
    const b = {
      format: BACKUP_FORMAT,
      schemaVersion: 1,
      shared: { people: [] },
      track: { transactions: [], categories: [], budgets: [], recurringRules: [] },
      split: { groups: [], members: [], expenses: [], payers: [], shares: [], settlements: [] },
      lend: { ledgers: [], entries: [] },
    };
    expect(() => validateBackup(b)).not.toThrow();
  });

  it('round-trips: export then restore', async () => {
    const db = getDB();
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
      currency: 'INR',
      date: '2026-08-13',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
      revision: 1,
    });

    const b = await exportBackup();
    expect(b.shared.people).toHaveLength(1);
    expect(b.track.transactions).toHaveLength(1);

    // Wipe
    await db.people.clear();
    await db.trackTransactions.clear();
    expect(await db.people.toArray()).toHaveLength(0);

    // Restore
    await restoreBackup(validateBackup(b));
    expect(await db.people.toArray()).toHaveLength(1);
    expect(await db.trackTransactions.toArray()).toHaveLength(1);
  });

  it('summarizeBackup reports counts', async () => {
    const db = getDB();
    await db.people.put({ id: 'p1', name: 'A', createdAt: '', updatedAt: '', revision: 1 });
    const b = await exportBackup();
    const s = summarizeBackup(b);
    expect(s.people).toBe(1);
  });
});
