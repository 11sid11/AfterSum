import { beforeEach, describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { getDB } from '@db/database';
import { freshDB, wipeDB } from '@tests/db-test-utils';
import { buildFullZip } from './builder';

const timestamp = '2026-08-19T00:00:00.000Z';
const base = { createdAt: timestamp, updatedAt: timestamp, revision: 1 } as const;

async function unzipFiles(blob: Blob) {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}

describe('full ZIP active-row policy', () => {
  beforeEach(async () => {
    await wipeDB();
    freshDB();
  });

  it('omits soft-deleted financial rows and reports active manifest counts', async () => {
    const db = getDB();
    await db.settings.put({
      id: 'app',
      defaultCurrency: 'INR',
      theme: 'system',
      hideAmounts: false,
      onboardingComplete: true,
      ...base,
    });
    await db.trackTransactions.bulkPut([
      {
        id: 'active',
        type: 'expense',
        title: 'Visible coffee',
        amountMinor: 10000,
        currency: 'INR',
        date: '2026-08-19',
        ...base,
      },
      {
        id: 'deleted',
        type: 'expense',
        title: 'Deleted dinner',
        amountMinor: 50000,
        currency: 'INR',
        date: '2026-08-19',
        deletedAt: timestamp,
        ...base,
      },
    ]);

    const files = await unzipFiles(await buildFullZip({ includeOverview: false }));
    const transactions = strFromU8(files['track/transactions.csv']!);
    const manifest = JSON.parse(strFromU8(files['manifest.json']!)) as {
      counts: { trackTransactions: number };
    };

    expect(transactions).toContain('Visible coffee');
    expect(transactions).not.toContain('Deleted dinner');
    expect(manifest.counts.trackTransactions).toBe(1);
  });

  it('does not export child Split rows when their trip is deleted', async () => {
    const db = getDB();
    await db.splitGroups.put({
      id: 'g1',
      name: 'Deleted trip',
      currency: 'INR',
      archived: false,
      deletedAt: timestamp,
      ...base,
    });
    await db.splitExpenses.put({
      id: 'e1',
      groupId: 'g1',
      title: 'Old dinner',
      amountMinor: 10000,
      currency: 'INR',
      date: '2026-08-19',
      splitMethod: 'equal',
      ...base,
    });

    const files = await unzipFiles(await buildFullZip({ includeOverview: false }));
    const expenses = strFromU8(files['split/expenses.csv']!);
    const manifest = JSON.parse(strFromU8(files['manifest.json']!)) as {
      counts: { splitGroups: number; splitExpenses: number };
    };

    expect(expenses).not.toContain('Old dinner');
    expect(manifest.counts.splitGroups).toBe(0);
    expect(manifest.counts.splitExpenses).toBe(0);
  });
});
