/**
 * End-to-end backup E2E.
 *
 *   create sample data
 *    ↓
 *   export JSON
 *    ↓
 *   wipe DB
 *    ↓
 *   restore JSON
 *    ↓
 *   verify exact records
 *    ↓
 *   verify calculated balances
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB, wipeDB } from '../../tests/db-test-utils';
import { exportBackup, validateBackup, restoreBackup } from './backup';
import { getDB } from '@db/database';
import { SELF_PERSON_ID } from '@db/seed';
import { entryToSignedAmount } from '@modules/lend/domain/signs';

describe('backup E2E', () => {
  beforeEach(async () => {
    await wipeDB();
    freshDB();
  });

  it('preserves all data + calculated balances after restore', async () => {
    const db = getDB();

    await db.people.put({ id: SELF_PERSON_ID, name: 'Me', isSelf: true, createdAt: '', updatedAt: '', revision: 1 });
    await db.people.put({ id: 'rahul', name: 'Rahul', createdAt: '', updatedAt: '', revision: 1 });

    await db.lendLedgers.put({
      id: 'l1',
      personId: 'rahul',
      currency: 'INR',
      archived: false,
      createdAt: '',
      updatedAt: '',
      revision: 1,
    });
    await db.lendEntries.put({
      id: 'le1',
      ledgerId: 'l1',
      type: 'lent',
      amountMinor: 500000,
      date: '2026-08-13',
      createdAt: '',
      updatedAt: '',
      revision: 1,
    });

    await db.trackTransactions.put({
      id: 't1',
      type: 'expense',
      title: 'Coffee',
      amountMinor: 15000,
      currency: 'INR',
      date: '2026-08-13',
      createdAt: '',
      updatedAt: '',
      revision: 1,
    });

    const backup = await exportBackup();
    expect(backup.shared.people).toHaveLength(2);
    expect(backup.shared.settings.defaultCurrency).toBe('INR');
    expect(backup.lend.entries).toHaveLength(1);
    expect(backup.track.transactions).toHaveLength(1);

    await db.people.clear();
    await db.lendLedgers.clear();
    await db.lendEntries.clear();
    await db.trackTransactions.clear();
    expect(await db.people.toArray()).toHaveLength(0);

    await restoreBackup(validateBackup(backup));

    const people = await db.people.toArray();
    expect(people).toHaveLength(2);
    expect(people.find((person) => person.id === 'rahul')?.name).toBe('Rahul');
    expect(people.find((person) => person.id === SELF_PERSON_ID)?.isSelf).toBe(true);

    const entries = await db.lendEntries.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.amountMinor).toBe(500000);

    const transactions = await db.trackTransactions.toArray();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.title).toBe('Coffee');

    const balance = entries.reduce((sum, entry) => sum + entryToSignedAmount(entry), 0);
    expect(balance).toBe(500000);
  });
});
