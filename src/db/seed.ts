/**
 * First-launch initialization.
 *
 * On the first time the app boots, we:
 *   1. create default app settings
 *   2. create the self Person
 *   3. create default Track categories
 *   4. mark onboarding complete
 *
 * Persistent storage is requested only through an explicit
 * onboarding action, never automatically.
 */

import { getDB } from './database';
import { newId, prefixedId } from '@shared/ids';
import { nowISO } from '@shared/dates';
import type {
  AppSettings,
  Person,
  TrackCategory,
} from './schema';

export const SELF_PERSON_ID = 'self';

const DEFAULT_EXPENSE_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: 'Food', icon: 'utensils' },
  { name: 'Travel', icon: 'plane' },
  { name: 'Shopping', icon: 'shopping-bag' },
  { name: 'Bills', icon: 'receipt' },
  { name: 'Entertainment', icon: 'film' },
  { name: 'Health', icon: 'heart' },
  { name: 'Education', icon: 'book' },
  { name: 'Other', icon: 'circle' },
];

const DEFAULT_INCOME_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: 'Income', icon: 'trending-up' },
];

/**
 * Ensure the database is in a usable first-launch state.
 * Idempotent: safe to call on every boot.
 */
export async function ensureFirstLaunch(): Promise<void> {
  const db = getDB();

  const existingSettings = await db.settings.get('app');
  if (existingSettings?.onboardingComplete) return;

  const now = nowISO();
  const newRevision = 1;

  const settings: AppSettings = {
    id: 'app',
    createdAt: now,
    updatedAt: now,
    revision: newRevision,
    defaultCurrency: 'INR',
    theme: 'system',
    hideAmounts: false,
    googleSyncEnabled: false,
    onboardingComplete: true,
  };

  const selfPerson: Person = {
    id: SELF_PERSON_ID,
    name: 'Me',
    createdAt: now,
    updatedAt: now,
    revision: newRevision,
    isSelf: true,
  };

  const categories: TrackCategory[] = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
      id: prefixedId('cat'),
      name: c.name,
      type: 'expense' as const,
      icon: c.icon,
      archived: false,
      createdAt: now,
      updatedAt: now,
      revision: newRevision,
      sortOrder: i,
    })),
    ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({
      id: prefixedId('cat'),
      name: c.name,
      type: 'income' as const,
      icon: c.icon,
      archived: false,
      createdAt: now,
      updatedAt: now,
      revision: newRevision,
      sortOrder: 100 + i,
    })),
  ];

  await db.transaction('rw', db.settings, db.people, db.trackCategories, async () => {
    await db.settings.put(settings);
    await db.people.put(selfPerson);
    await db.trackCategories.bulkPut(categories);
  });
}

/** Create a new id (re-exported here for convenience). */
export { newId, prefixedId };
