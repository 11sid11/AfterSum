/**
 * Base repository helpers.
 *
 * Repositories are the only place that touch Dexie. Components
 * and services call `xxxRepository.create()` etc. They never
 * reach into `db.table.add(...)` directly.
 *
 * Every write:
 *   - sets `createdAt` / `updatedAt`
 *   - increments `revision`
 *   - supports soft delete + undo
 */

import { newId } from '@shared/ids';
import { nowISO } from '@shared/dates';
import type { BaseEntity } from '@db/schema';

export type CreateInput<T extends BaseEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt' | 'revision' | 'deletedAt'
> & { id?: string };

/** Insert a new row. */
export async function repoCreate<T extends BaseEntity>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  input: CreateInput<T>,
): Promise<T> {
  const now = nowISO();
  const row = {
    ...input,
    id: input.id ?? newId(),
    createdAt: now,
    updatedAt: now,
    revision: 1,
  } as T;
  await table.add(row);
  return row;
}

/** Update an existing row by id. Increments `revision`. */
export async function repoUpdate<T extends BaseEntity>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  id: string,
  patch: Partial<Omit<T, 'id' | 'createdAt' | 'revision'>>,
): Promise<T> {
  const now = nowISO();
  const existing = await table.get(id);
  if (!existing) {
    throw new Error(`repoUpdate: entity not found: ${id}`);
  }
  const next: T = {
    ...existing,
    ...patch,
    id,
    updatedAt: now,
    revision: (existing.revision ?? 0) + 1,
  };
  await table.put(next);
  return next;
}

/** Soft-delete a row. Sets `deletedAt`, leaves the record. */
export async function repoSoftDelete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  id: string,
): Promise<void> {
  const now = nowISO();
  const existing = await table.get(id);
  if (!existing) return;
  await table.put({ ...existing, deletedAt: now, updatedAt: now, revision: (existing.revision ?? 0) + 1 });
}

/** Restore a soft-deleted row (used by Undo). */
export async function repoRestore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  id: string,
): Promise<void> {
  const now = nowISO();
  const existing = await table.get(id);
  if (!existing) return;
  const { deletedAt: _deletedAt, ...rest } = existing;
  void _deletedAt;
  await table.put({ ...rest, updatedAt: now, revision: (existing.revision ?? 0) + 1 });
}

/** Hard-delete (used by wipe / restore from backup). */
export async function repoHardDelete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  id: string,
): Promise<void> {
  await table.delete(id);
}
