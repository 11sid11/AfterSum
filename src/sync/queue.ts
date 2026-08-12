/**
 * Sync queue.
 *
 * V1 keeps a simple log of pending mutations. The Google
 * sync worker drains this queue when the user is connected
 * and authorized. The queue is intentionally minimal —
 * we never need distributed-system-grade durability here.
 */

import { getDB } from '@db/database';
import { newId } from '@shared/ids';
import { nowISO } from '@shared/dates';
import type { SyncOp, SyncQueueItem } from '@db/schema';

export async function enqueue(
  entity: SyncQueueItem['entity'],
  entityId: string,
  op: SyncOp,
  payload?: unknown,
): Promise<SyncQueueItem> {
  const now = nowISO();
  const item: SyncQueueItem = {
    id: newId(),
    entity,
    entityId,
    op,
    payload,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  };
  await getDB().syncQueue.add(item);
  return item;
}

export async function listPending(limit = 100): Promise<SyncQueueItem[]> {
  return getDB()
    .syncQueue.orderBy('createdAt')
    .limit(limit)
    .toArray();
}

export async function clearQueue(): Promise<void> {
  await getDB().syncQueue.clear();
}
