/**
 * App settings repository.
 */

import { getDB } from '@db/database';
import { nowISO } from '@shared/dates';
import type { AppSettings, AppTheme } from '@db/schema';
import { markDirty } from '@sync/status';

export const DEFAULT_SETTINGS: Omit<AppSettings, 'createdAt' | 'updatedAt' | 'revision'> = {
  id: 'app',
  defaultCurrency: 'INR',
  theme: 'system',
  hideAmounts: false,
  onboardingComplete: false,
};

async function writeWithoutDirty(patch: Partial<AppSettings>): Promise<AppSettings> {
  const db = getDB();
  const cur = await settingsRepository.get();
  const now = nowISO();
  const next: AppSettings = {
    ...cur,
    ...patch,
    id: 'app',
    updatedAt: now,
    revision: (cur.revision ?? 0) + 1,
  };
  await db.settings.put(next);
  return next;
}

export const settingsRepository = {
  async get(): Promise<AppSettings> {
    const db = getDB();
    const row = await db.settings.get('app');
    if (row) return row;
    const now = nowISO();
    const initial: AppSettings = {
      ...DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    await db.settings.put(initial);
    return initial;
  },

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = await writeWithoutDirty(patch);
    await markDirty();
    return next;
  },

  async setDefaultCurrency(currency: string): Promise<AppSettings> {
    const db = getDB();
    const cur = await settingsRepository.get();
    if (currency === cur.defaultCurrency) return cur;

    const [trackTransactions, trackBudgets, splitGroups, lendLedgers] = await Promise.all([
      db.trackTransactions.count(),
      db.trackBudgets.count(),
      db.splitGroups.count(),
      db.lendLedgers.count(),
    ]);
    const hasFinancialData = trackTransactions + trackBudgets + splitGroups + lendLedgers > 0;
    if (hasFinancialData) {
      throw new Error('Default currency is locked after financial data has been recorded.');
    }
    return settingsRepository.update({ defaultCurrency: currency });
  },

  async setTheme(theme: AppTheme): Promise<AppSettings> {
    return settingsRepository.update({ theme });
  },

  async setHideAmounts(hide: boolean): Promise<AppSettings> {
    return settingsRepository.update({ hideAmounts: hide });
  },

  async setOnboardingComplete(complete: boolean): Promise<AppSettings> {
    return settingsRepository.update({ onboardingComplete: complete });
  },

  /** Device metadata only; recording a backup does not change financial data. */
  async setLastPortableBackupAt(timestamp: string): Promise<AppSettings> {
    return writeWithoutDirty({ lastPortableBackupAt: timestamp });
  },
};
