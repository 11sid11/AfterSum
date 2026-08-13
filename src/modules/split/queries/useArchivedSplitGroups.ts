import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import type { SplitGroup } from '@db/schema';

/** Archived, non-deleted trips, newest first. */
export function useArchivedSplitGroups(): SplitGroup[] | undefined {
  return useLiveQuery(async () => {
    const groups = await getDB().splitGroups.toArray();
    return groups
      .filter((group) => !group.deletedAt && group.archived)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, []);
}
