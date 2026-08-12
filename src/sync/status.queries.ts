/**
 * Live sync status hook.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import type { SyncMetadata } from '@db/schema';

export function useSyncStatus(): SyncMetadata | undefined {
  return useLiveQuery(async () => {
    return getDB().syncMetadata.get('google');
  }, []);
}
