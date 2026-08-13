/**
 * SplitGroup repository.
 *
 * Owns the Dexie `splitGroups` table. The Split module is the
 * only writer of this table.
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
  async list(): Promise<SplitGroup[]> {
    const all = await getDB().splitGroups.toArray();
    return all.filter((g) => !g.deletedAt).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async listActive(): Promise<SplitGroup[]> {
    const all = await getDB().splitGroups.toArray();
    return all
      .filter((g) => !g.deletedAt && !g.archived)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async get(id: string): Promise<SplitGroup | undefined> {
    return getDB().splitGroups.get(id);
  },

  async create(input: SplitGroupInput): Promise<SplitGroup> {
    const parsed = SplitGroupInputSchema.parse(input);
    const cleaned = clean(parsed);
    const withArchived = { ...cleaned, archived: cleaned.archived ?? false } as CreateInput<SplitGroup>;
    return repoCreate<SplitGroup>(getDB().splitGroups, withArchived);
  },

  async update(id: string, patch: SplitGroupUpdate): Promise<SplitGroup> {
    const parsed = SplitGroupInputSchema.partial().parse(patch);
    const db = getDB();
    if (parsed.currency !== undefined) {
      const current = await db.splitGroups.get(id);
      if (current && parsed.currency !== current.currency) {
        const [expenseCount, settlementCount] = await Promise.all([
          db.splitExpenses.where('groupId').equals(id).count(),
          db.splitSettlements.where('groupId').equals(id).count(),
        ]);
        if (expenseCount + settlementCount > 0) {
          throw new Error('Group currency is locked after expenses or settlements are recorded.');
        }
      }
    }
    return repoUpdate<SplitGroup>(db.splitGroups, id, clean(parsed));
  },

  async archive(id: string): Promise<SplitGroup> {
    return this.update(id, { archived: true });
  },

  async unarchive(id: string): Promise<SplitGroup> {
    return this.update(id, { archived: false });
  },

  async softDelete(id: string): Promise<void> {
    return repoSoftDelete(getDB().splitGroups, id);
  },

  async restore(id: string): Promise<void> {
    return repoRestore(getDB().splitGroups, id);
  },

  async _hardDelete(id: string): Promise<void> {
    return repoHardDelete(getDB().splitGroups, id);
  },

  async replaceAll(groups: SplitGroup[]): Promise<void> {
    const db = getDB();
    await db.splitGroups.clear();
    if (groups.length > 0) await db.splitGroups.bulkPut(groups);
  },
};

export type SplitGroupRepository = typeof splitGroupRepository;
