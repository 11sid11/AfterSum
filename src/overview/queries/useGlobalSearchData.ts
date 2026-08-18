/** Raw reactive rows used by global search. */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import type {
  LendEntry,
  LendLedger,
  Person,
  SplitExpense,
  SplitGroup,
  TrackTransaction,
} from '@db/schema';

export interface GlobalSearchData {
  track: TrackTransaction[];
  expenses: SplitExpense[];
  groups: SplitGroup[];
  people: Person[];
  lendEntries: LendEntry[];
  ledgers: LendLedger[];
}

export function useGlobalSearchData(): GlobalSearchData | undefined {
  return useLiveQuery(async () => {
    const db = getDB();
    const [track, expenses, groups, people, lendEntries, ledgers] = await Promise.all([
      db.trackTransactions.toArray(),
      db.splitExpenses.toArray(),
      db.splitGroups.toArray(),
      db.people.toArray(),
      db.lendEntries.toArray(),
      db.lendLedgers.toArray(),
    ]);
    return { track, expenses, groups, people, lendEntries, ledgers };
  }, []);
}
