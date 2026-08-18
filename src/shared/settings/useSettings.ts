/** Settings live queries. */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';

export function useAppSettings() {
  return useLiveQuery(async () => getDB().settings.get('app'), []);
}

export interface SettingsStats {
  people: number;
  track: number;
  groups: number;
  lendLedgers: number;
  budgets: number;
}

/** Small settings-screen summary; financial counts include soft-deleted history. */
export function useSettingsStats(): SettingsStats | undefined {
  return useLiveQuery(async () => {
    const db = getDB();
    const [peopleRows, track, groups, lendLedgers, budgets] = await Promise.all([
      db.people.toArray(),
      db.trackTransactions.count(),
      db.splitGroups.count(),
      db.lendLedgers.count(),
      db.trackBudgets.count(),
    ]);
    return {
      people: peopleRows.filter((person) => !person.deletedAt).length,
      track,
      groups,
      lendLedgers,
      budgets,
    };
  }, []);
}
