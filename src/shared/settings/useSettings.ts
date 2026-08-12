/**
 * Settings queries (live).
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';

export function useAppSettings() {
  return useLiveQuery(async () => {
    const row = await getDB().settings.get('app');
    return row;
  }, []);
}
