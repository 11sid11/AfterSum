import { beforeEach, describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { getDB } from '@db/database';
import { freshDB, wipeDB } from '@tests/db-test-utils';
import { buildFullZip, README_TEXT } from './builder';

const createdAt = '2026-08-18T00:00:00.000Z';
const base = { createdAt, updatedAt: createdAt, revision: 1 } as const;

async function unzipText(blob: Blob, path: string): Promise<string> {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const file = files[path];
  if (!file) throw new Error(`Missing ZIP entry: ${path}`);
  return strFromU8(file);
}

describe('full ZIP export', () => {
  beforeEach(async () => {
    await wipeDB();
    freshDB();
  });

  it('keeps Split group balances scoped and preserves currency precision', async () => {
    const db = getDB();
    await db.settings.put({
      id: 'app',
      defaultCurrency: 'USD',
      theme: 'system',
      hideAmounts: false,
      onboardingComplete: true,
      ...base,
    });
    await db.people.bulkPut([
      { id: 'p1', name: 'Rahul, Sr.', ...base },
      { id: 'p2', name: 'Aman', ...base },
    ]);
    await db.splitGroups.bulkPut([
      { id: 'g1', name: 'Goa', currency: 'INR', archived: false, ...base },
      { id: 'g2', name: 'Tokyo', currency: 'JPY', archived: false, ...base },
    ]);
    await db.splitGroupMembers.bulkPut([
      { id: 'm1', groupId: 'g1', personId: 'p1', active: true, joinedAt: createdAt, ...base },
      { id: 'm2', groupId: 'g1', personId: 'p2', active: true, joinedAt: createdAt, ...base },
      { id: 'm3', groupId: 'g2', personId: 'p1', active: true, joinedAt: createdAt, ...base },
      { id: 'm4', groupId: 'g2', personId: 'p2', active: true, joinedAt: createdAt, ...base },
    ]);
    await db.splitExpenses.bulkPut([
      {
        id: 'e1',
        groupId: 'g1',
        title: 'Hotel',
        amountMinor: 10000,
        currency: 'INR',
        date: '2026-08-10',
        splitMethod: 'equal',
        ...base,
      },
      {
        id: 'e2',
        groupId: 'g2',
        title: 'Train',
        amountMinor: 1000,
        currency: 'JPY',
        date: '2026-08-11',
        splitMethod: 'equal',
        ...base,
      },
    ]);
    await db.splitPayers.bulkPut([
      { id: 'pay1', expenseId: 'e1', personId: 'p1', amountMinor: 10000, ...base },
      { id: 'pay2', expenseId: 'e2', personId: 'p2', amountMinor: 1000, ...base },
    ]);
    await db.splitShares.bulkPut([
      { id: 'share1', expenseId: 'e1', personId: 'p1', amountMinor: 5000, ...base },
      { id: 'share2', expenseId: 'e1', personId: 'p2', amountMinor: 5000, ...base },
      { id: 'share3', expenseId: 'e2', personId: 'p1', amountMinor: 500, ...base },
      { id: 'share4', expenseId: 'e2', personId: 'p2', amountMinor: 500, ...base },
    ]);
    await db.lendLedgers.put({
      id: 'l1',
      personId: 'p1',
      currency: 'KWD',
      archived: false,
      ...base,
    });
    await db.lendEntries.put({
      id: 'le1',
      ledgerId: 'l1',
      type: 'lent',
      amountMinor: 1234,
      date: '2026-08-12',
      ...base,
    });
    await db.trackTransactions.bulkPut([
      {
        id: 't1',
        type: 'expense',
        title: 'Tokyo metro',
        amountMinor: 1500,
        currency: 'JPY',
        date: '2026-08-12',
        ...base,
      },
      {
        id: 't2',
        type: 'income',
        title: 'Refund',
        amountMinor: 1234,
        currency: 'KWD',
        date: '2026-08-12',
        ...base,
      },
    ]);

    const zip = await buildFullZip();
    const peopleSummary = await unzipText(zip, 'overview/people-summary.csv');
    const track = await unzipText(zip, 'track/transactions.csv');
    const monthly = await unzipText(zip, 'overview/monthly-summary.csv');

    expect(peopleSummary).toContain('"Rahul, Sr."');
    expect(peopleSummary).toContain('KWD 1.234');
    expect(peopleSummary).toContain('INR 50.00 | JPY -500');
    expect(peopleSummary).not.toContain('INR -5.00');
    expect(track).toContain('1500,1500,JPY');
    expect(track).toContain('1.234,1234,KWD');
    expect(monthly).toContain('2026-08,1500,0,JPY');
    expect(monthly).toContain('2026-08,0.000,1.234,KWD');
  });

  it('uses AfterSum terminology in the bundled readme', () => {
    expect(README_TEXT).toContain('AfterSum — Data Export');
    expect(README_TEXT).toContain('Settings → Data & Storage → Portable backup');
    expect(README_TEXT).not.toContain('Finance Utility — Data Export');
  });
});
