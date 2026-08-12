/**
 * SplitGroup repository.
 *
 * Owns the Dexie `splitGroups` table. The Split module is the
 * ONLY writer of this table.
 */

import { getDB } from '@db/database';
import {
  repoCreate,
  repoUpdate,
  repoSoftDelete,
  repoRestore,
  repoHardDelete,
  type CreateInput,
} from '@db/repositories/base';
import { SplitGroupInputSchema, type SplitGroupInput, type SplitGroupUpdate } from '../domain/validation';
import type { SplitGroup } from '@db/schema';

function clean(input: Partial<SplitGroupInput>): Partial<SplitGroupInput> {
  return {
    ...input,
    description: input.description || undefined,
  };
}

export const splitGroupRepository = {
  /** All groups, including archived and soft-deleted (for admin screens). */
  async list(): Promise<SplitGroup[]> {
    const all = await getDB().splitGroups.toArray();
    return all
      .filter((g) => !g.deletedAt)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  /** All active, non-archived groups. Used by the dashboard. */
  async listActive(): Promise<SplitGroup[]> {
    const all = await getDB().splitGroups.toArray();
    return all
      .filter((g) => !g.deletedAt && !g.archived)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  /** Single group by id. */
  async get(id: string): Promise<SplitGroup | undefined> {
    return getDB().splitGroups.get(id);
  },

  /** Create a new group. */
  async create(input: SplitGroupInput): Promise<SplitGroup> {
    const parsed = SplitGroupInputSchema.parse(input);
    const cleaned = clean(parsed);
    const withArchived = { ...cleaned, archived: cleaned.archived ?? false } as CreateInput<SplitGroup>;
    return repoCreate<SplitGroup>(getDB().splitGroups, withArchived);
  },

  /** Patch an existing group. */
  async update(id: string, patch: SplitGroupUpdate): Promise<SplitGroup> {
    const parsed = SplitGroupInputSchema.partial().parse(patch);
    return repoUpdate<SplitGroup>(getDB().splitGroups, id, clean(parsed));
  },

  /** Archive (logical flag) — group is hidden from the dashboard. */
  async archive(id: string): Promise<SplitGroup> {
    return this.update(id, { archived: true });
  },

  /** Unarchive. */
  async unarchive(id: string): Promise<SplitGroup> {
    return this.update(id, { archived: false });
  },

  /** Soft-delete. */
  async softDelete(id: string): Promise<void> {
    return repoSoftDelete(getDB().splitGroups, id);
  },

  /** Restore a soft-deleted group. */
  async restore(id: string): Promise<void> {
    return repoRestore(getDB().splitGroups, id);
  },

  /** Hard-delete a single group. Used by JSON restore. */
  async _hardDelete(id: string): Promise<void> {
    return repoHardDelete(getDB().splitGroups, id);
  },

  /** Bulk replace (used by JSON restore). */
  async replaceAll(groups: SplitGroup[]): Promise<void> {
    const db = getDB();
    await db.splitGroups.clear();
    if (groups.length > 0) await db.splitGroups.bulkPut(groups);
  },
};

export type SplitGroupRepository = typeof splitGroupRepository;
