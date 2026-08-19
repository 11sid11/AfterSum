/**
 * Track module — repository round-trip tests.
 *
 * Uses freshDB so each test starts with an empty database.
 * Covers create / update / softDelete / restore / listByMonth
 * for all four Track tables.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB, wipeDB } from '@/tests/db-test-utils';
import { trackCategoryRepository } from './trackCategoryRepository';
import { trackTransactionRepository } from './trackTransactionRepository';
import { trackBudgetRepository } from './trackBudgetRepository';
import { trackRecurringRepository, computeNextDate } from './trackRecurringRepository';
import { getDB } from '@db/database';

beforeEach(async () => {
  await wipeDB();
  freshDB();
});

describe('trackCategoryRepository', () => {
  it('create + get + listActive', async () => {
    const c = await trackCategoryRepository.create({ name: 'Food', type: 'expense' });
    expect(c.id).toBeTruthy();
    const got = await trackCategoryRepository.get(c.id);
    expect(got?.name).toBe('Food');
    const list = await trackCategoryRepository.listActive();
    expect(list).toHaveLength(1);
  });

  it('softDelete hides from listActive; row still in Dexie', async () => {
    const c = await trackCategoryRepository.create({ name: 'Food', type: 'expense' });
    await trackCategoryRepository.softDelete(c.id);
    expect(await trackCategoryRepository.listActive()).toHaveLength(0);
    const raw = await getDB().trackCategories.get(c.id);
    expect(raw).toBeDefined();
    expect(raw?.deletedAt).toBeTruthy();
  });

  it('restore brings the row back', async () => {
    const c = await trackCategoryRepository.create({ name: 'Food', type: 'expense' });
    await trackCategoryRepository.softDelete(c.id);
    await trackCategoryRepository.restore(c.id);
    expect(await trackCategoryRepository.listActive()).toHaveLength(1);
  });

  it('setArchived excludes from listActive by default', async () => {
    const c = await trackCategoryRepository.create({ name: 'Food', type: 'expense' });
    await trackCategoryRepository.setArchived(c.id, true);
    expect(await trackCategoryRepository.listActive()).toHaveLength(0);
    expect((await trackCategoryRepository.listActive('expense', true)).find((x) => x.id === c.id)).toBeDefined();
  });

  it('seedDefaults is idempotent', async () => {
    await trackCategoryRepository.seedDefaults();
    const a = await getDB().trackCategories.count();
    await trackCategoryRepository.seedDefaults();
    const b = await getDB().trackCategories.count();
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });
});

describe('trackTransactionRepository', () => {
  it('create + listByMonth filters by month', async () => {
    await trackTransactionRepository.create({
      type: 'expense',
      title: 'August lunch',
      amountMinor: 12000,
      currency: 'INR',
      date: '2026-08-15',
    });
    await trackTransactionRepository.create({
      type: 'expense',
      title: 'July lunch',
      amountMinor: 5000,
      currency: 'INR',
      date: '2026-07-15',
    });
    const aug = await trackTransactionRepository.listByMonth('2026-08');
    expect(aug).toHaveLength(1);
    expect(aug[0]?.title).toBe('August lunch');
  });

  it('update changes fields and bumps revision', async () => {
    const t = await trackTransactionRepository.create({
      type: 'expense',
      title: 'Old',
      amountMinor: 1000,
      currency: 'INR',
      date: '2026-08-01',
    });
    const before = t.revision;
    const updated = await trackTransactionRepository.update(t.id, { title: 'New' });
    expect(updated.title).toBe('New');
    expect(updated.revision).toBe(before + 1);
  });

  it('supports partial updates that do not include title', async () => {
    const t = await trackTransactionRepository.create({
      type: 'expense',
      title: 'Lunch',
      amountMinor: 1000,
      currency: 'INR',
      date: '2026-08-01',
    });
    const updated = await trackTransactionRepository.update(t.id, { amountMinor: 1250 });
    expect(updated.title).toBe('Lunch');
    expect(updated.amountMinor).toBe(1250);
  });

  it('softDelete + restore round-trips', async () => {
    const t = await trackTransactionRepository.create({
      type: 'expense',
      title: 't',
      amountMinor: 1000,
      currency: 'INR',
      date: '2026-08-01',
    });
    await trackTransactionRepository.softDelete(t.id);
    expect(await trackTransactionRepository.list()).toHaveLength(0);
    await trackTransactionRepository.restore(t.id);
    expect(await trackTransactionRepository.list()).toHaveLength(1);
  });

  it('listByDateRange is inclusive', async () => {
    await trackTransactionRepository.create({
      type: 'expense',
      title: 'a',
      amountMinor: 100,
      currency: 'INR',
      date: '2026-08-01',
    });
    await trackTransactionRepository.create({
      type: 'expense',
      title: 'b',
      amountMinor: 100,
      currency: 'INR',
      date: '2026-08-15',
    });
    await trackTransactionRepository.create({
      type: 'expense',
      title: 'c',
      amountMinor: 100,
      currency: 'INR',
      date: '2026-08-31',
    });
    const inRange = await trackTransactionRepository.listByDateRange('2026-08-10', '2026-08-20');
    expect(inRange).toHaveLength(1);
    expect(inRange[0]?.title).toBe('b');
  });

  it('rejects zero amount via the Zod schema', async () => {
    await expect(
      trackTransactionRepository.create({
        type: 'expense',
        title: 'bad',
        amountMinor: 0,
        currency: 'INR',
        date: '2026-08-01',
      }),
    ).rejects.toThrow();
  });

  it('rejects negative amount via the Zod schema', async () => {
    await expect(
      trackTransactionRepository.create({
        type: 'expense',
        title: 'bad',
        amountMinor: -100,
        currency: 'INR',
        date: '2026-08-01',
      }),
    ).rejects.toThrow();
  });

  it('rejects blank title via the Zod schema', async () => {
    await expect(
      trackTransactionRepository.create({
        type: 'expense',
        title: '   ',
        amountMinor: 100,
        currency: 'INR',
        date: '2026-08-01',
      }),
    ).rejects.toThrow();
  });

  it('rejects impossible calendar dates', async () => {
    await expect(
      trackTransactionRepository.create({
        type: 'expense',
        title: 'bad date',
        amountMinor: 100,
        currency: 'INR',
        date: '2026-02-30',
      }),
    ).rejects.toThrow(/calendar date/);
  });
});

describe('trackBudgetRepository', () => {
  it('getByMonth returns undefined when none', async () => {
    expect(await trackBudgetRepository.getByMonth('2026-08')).toBeUndefined();
  });

  it('setForMonth upserts', async () => {
    const a = await trackBudgetRepository.setForMonth({
      month: '2026-08',
      amountMinor: 30000,
      currency: 'INR',
    });
    expect(a.amountMinor).toBe(30000);
    const b = await trackBudgetRepository.setForMonth({
      month: '2026-08',
      amountMinor: 40000,
      currency: 'INR',
    });
    expect(b.id).toBe(a.id);
    expect(b.amountMinor).toBe(40000);
    const list = await trackBudgetRepository.listAll();
    expect(list).toHaveLength(1);
  });

  it('rejects impossible month keys', async () => {
    await expect(
      trackBudgetRepository.setForMonth({
        month: '2026-13',
        amountMinor: 30000,
        currency: 'INR',
      }),
    ).rejects.toThrow(/calendar month/);
  });

  it('deleteByMonth removes the row', async () => {
    await trackBudgetRepository.setForMonth({ month: '2026-08', amountMinor: 30000, currency: 'INR' });
    await trackBudgetRepository.deleteByMonth('2026-08');
    expect(await trackBudgetRepository.getByMonth('2026-08')).toBeUndefined();
  });
});

describe('trackRecurringRepository', () => {
  it('listActive + setEnabled', async () => {
    const r = await trackRecurringRepository.create({
      title: 'Rent',
      amountMinor: 1500000,
      currency: 'INR',
      frequency: 'monthly',
      nextDate: '2026-09-01',
      enabled: true,
    });
    expect((await trackRecurringRepository.listActive())[0]?.id).toBe(r.id);
    await trackRecurringRepository.setEnabled(r.id, false);
    expect((await trackRecurringRepository.listActive())[0]?.enabled).toBe(false);
  });

  it('due returns only past-due enabled rules', async () => {
    await trackRecurringRepository.create({
      title: 'Past',
      currency: 'INR',
      frequency: 'monthly',
      nextDate: '2020-01-01',
      enabled: true,
    });
    await trackRecurringRepository.create({
      title: 'Future',
      currency: 'INR',
      frequency: 'monthly',
      nextDate: '2099-12-31',
      enabled: true,
    });
    await trackRecurringRepository.create({
      title: 'Disabled',
      currency: 'INR',
      frequency: 'monthly',
      nextDate: '2020-01-01',
      enabled: false,
    });
    const due = await trackRecurringRepository.due('2026-08-01');
    expect(due).toHaveLength(1);
    expect(due[0]?.title).toBe('Past');
  });

  it('softDelete + restore round-trips', async () => {
    const r = await trackRecurringRepository.create({
      title: 'Rent',
      currency: 'INR',
      frequency: 'monthly',
      nextDate: '2026-09-01',
      enabled: true,
    });
    await trackRecurringRepository.softDelete(r.id);
    expect(await trackRecurringRepository.listActive()).toHaveLength(0);
    await trackRecurringRepository.restore(r.id);
    expect(await trackRecurringRepository.listActive()).toHaveLength(1);
  });

  it('advance bumps nextDate by frequency', async () => {
    const r = await trackRecurringRepository.create({
      title: 'Rent',
      currency: 'INR',
      frequency: 'monthly',
      nextDate: '2026-08-01',
      enabled: true,
    });
    const updated = await trackRecurringRepository.advance(r.id);
    expect(updated?.nextDate).toBe('2026-09-01');
  });
});

describe('computeNextDate', () => {
  it('weekly adds 7 days', () => {
    expect(computeNextDate('2026-08-15', 'weekly')).toBe('2026-08-22');
  });
  it('monthly adds 1 month (handles end-of-month)', () => {
    expect(computeNextDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(computeNextDate('2026-08-15', 'monthly')).toBe('2026-09-15');
  });
  it('yearly adds 1 year', () => {
    expect(computeNextDate('2026-08-15', 'yearly')).toBe('2027-08-15');
  });
});
