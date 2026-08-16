import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { freshDB, wipeDB } from '@/tests/db-test-utils';
import { getDB } from '@db/database';
import { settingsRepository } from '@shared/settings/repository';
import { useOverviewSummary } from './index';

describe('useOverviewSummary', () => {
  beforeEach(async () => {
    await wipeDB();
    freshDB();
    await settingsRepository.get();
  });

  it('loads a monthly budget through the month index rather than treating month as the primary key', async () => {
    const now = new Date().toISOString();
    await getDB().trackBudgets.put({
      id: 'budget-generated-id',
      month: '2026-08',
      amountMinor: 500_000,
      currency: 'INR',
      createdAt: now,
      updatedAt: now,
      revision: 1,
    });

    const { result } = renderHook(() => useOverviewSummary('2026-08'));

    await waitFor(() => expect(result.current?.track.budgetMinor).toBe(500_000));
    expect(result.current?.track.budgetRemainingMinor).toBe(500_000);
  });

  it('excludes archived Lend ledgers from current Overview balances', async () => {
    const db = getDB();
    const now = new Date().toISOString();
    await db.lendLedgers.bulkPut([
      {
        id: 'active-ledger',
        personId: 'person-active',
        currency: 'INR',
        archived: false,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
      {
        id: 'archived-ledger',
        personId: 'person-archived',
        currency: 'INR',
        archived: true,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
    ]);
    await db.lendEntries.bulkPut([
      {
        id: 'active-entry',
        ledgerId: 'active-ledger',
        type: 'lent',
        amountMinor: 10_000,
        date: '2026-08-01',
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
      {
        id: 'archived-entry',
        ledgerId: 'archived-ledger',
        type: 'lent',
        amountMinor: 99_000,
        date: '2026-08-01',
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
    ]);

    const { result } = renderHook(() => useOverviewSummary('2026-08'));

    await waitFor(() => expect(result.current?.lend.youWillReceiveMinor).toBe(10_000));
    expect(result.current?.lend.youOweMinor).toBe(0);
  });
});
