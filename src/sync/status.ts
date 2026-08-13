/**
 * Local sync state.
 *
 * Tracks whether local financial data has changed since the last successful
 * optional cloud backup. Google Sheets is a one-way snapshot target plus an
 * explicit restore source; manual sheet edits are never interpreted as app
 * actions.
 */

import { getDB } from '@db/database';
import { nowISO } from '@shared/dates';
import type { SyncMetadata, SyncStatus } from '@db/schema';

const SYNC_ID: SyncMetadata['id'] = 'google';

const DEFAULT_METADATA: SyncMetadata = {
  id: SYNC_ID,
  createdAt: '',
  updatedAt: '',
  revision: 1,
  status: 'saved',
  dirty: false,
};

export async function getSyncMetadata(): Promise<SyncMetadata> {
  const db = getDB();
  const row = await db.syncMetadata.get(SYNC_ID);
  if (row) return row;

  const now = nowISO();
  const initial: SyncMetadata = { ...DEFAULT_METADATA, createdAt: now, updatedAt: now };
  await db.syncMetadata.put(initial);
  return initial;
}

export async function setSyncStatus(
  status: SyncStatus,
  extras?: Partial<Pick<SyncMetadata, 'lastError' | 'lastSuccessfulSyncAt' | 'lastLocalChangeAt'>>,
): Promise<SyncMetadata> {
  const db = getDB();
  const cur = await getSyncMetadata();
  const now = nowISO();
  const next: SyncMetadata = {
    ...cur,
    status,
    updatedAt: now,
    revision: (cur.revision ?? 0) + 1,
    ...extras,
  };
  await db.syncMetadata.put(next);
  return next;
}

export async function markDirty(): Promise<void> {
  const db = getDB();
  const cur = await getSyncMetadata();
  if (cur.dirty && cur.status === 'pending') return;

  const now = nowISO();
  const next: SyncMetadata = {
    ...cur,
    dirty: true,
    status: cur.status === 'synced' ? 'pending' : cur.status,
    lastLocalChangeAt: now,
    updatedAt: now,
    revision: (cur.revision ?? 0) + 1,
  };
  await db.syncMetadata.put(next);
}

export async function markSynced(): Promise<void> {
  const db = getDB();
  const cur = await getSyncMetadata();
  const now = nowISO();
  await db.syncMetadata.put({
    ...cur,
    dirty: false,
    status: 'synced',
    lastSuccessfulSyncAt: now,
    lastError: undefined,
    updatedAt: now,
    revision: (cur.revision ?? 0) + 1,
  });
}
