/**
 * TrackCategory repository.
 *
 * Owns the Dexie `trackCategories` table. The Track module is
 * the ONLY writer of this table.
 *
 * Default categories are seeded by `ensureFirstLaunch`; this
 * repo only manages the user-facing CRUD operations.
 */

import { getDB } from '@db/database';
import {
  repoCreate,
  repoUpdate,
  repoSoftDelete,
  repoRestore,
  type CreateInput,
} from '@db/repositories/base';
import { TrackCategoryInputSchema, type TrackCategoryInput } from '../domain/validation';
import { prefixedId } from '@shared/ids';
import type { TrackCategory } from '@db/schema';

function clean(input: Partial<TrackCategoryInput>): Partial<TrackCategoryInput> {
  return {
    ...input,
    icon: input.icon || undefined,
  };
}

export const trackCategoryRepository = {
  /**
   * All non-deleted categories. Pass `includeArchived = true`
   * to also include archived categories. Optionally filter
   * by `type`.
   */
  async listActive(
    type?: 'expense' | 'income',
    includeArchived = false,
  ): Promise<TrackCategory[]> {
    const all = await getDB().trackCategories.toArray();
    return all
      .filter((c) => !c.deletedAt)
      .filter((c) => (includeArchived ? true : !c.archived))
      .filter((c) => (type ? c.type === type : true))
      .sort((a, b) => {
        if (a.archived !== b.archived) return a.archived ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  },

  /** Alias of `listActive(undefined, true)` — all categories including archived. */
  async listAll(type?: 'expense' | 'income'): Promise<TrackCategory[]> {
    return this.listActive(type, true);
  },

  async get(id: string): Promise<TrackCategory | undefined> {
    return getDB().trackCategories.get(id);
  },

  async create(input: TrackCategoryInput): Promise<TrackCategory> {
    const parsed = TrackCategoryInputSchema.parse(input);
    const cleaned = clean(parsed);
    return repoCreate<TrackCategory>(getDB().trackCategories, {
      ...(cleaned as CreateInput<TrackCategory>),
      archived: cleaned.archived ?? false,
    });
  },

  async update(id: string, patch: Partial<TrackCategoryInput>): Promise<TrackCategory> {
    const parsed = TrackCategoryInputSchema.partial().parse(patch);
    return repoUpdate<TrackCategory>(getDB().trackCategories, id, clean(parsed));
  },

  async setArchived(id: string, archived: boolean): Promise<TrackCategory> {
    return repoUpdate<TrackCategory>(getDB().trackCategories, id, { archived });
  },

  async softDelete(id: string): Promise<void> {
    return repoSoftDelete(getDB().trackCategories, id);
  },

  async restore(id: string): Promise<void> {
    return repoRestore(getDB().trackCategories, id);
  },

  /**
   * Seed the default category set if the table is empty.
   * Mirrors `ensureFirstLaunch` but is callable from a module
   * context (e.g. a "reset" action in settings).
   */
  async seedDefaults(): Promise<void> {
    const db = getDB();
    const existing = await db.trackCategories.count();
    if (existing > 0) return;
    const now = new Date().toISOString();
    const expense = [
      { name: 'Food', icon: 'utensils' },
      { name: 'Travel', icon: 'plane' },
      { name: 'Shopping', icon: 'shopping-bag' },
      { name: 'Bills', icon: 'receipt' },
      { name: 'Entertainment', icon: 'film' },
      { name: 'Health', icon: 'heart' },
      { name: 'Education', icon: 'book' },
      { name: 'Other', icon: 'circle' },
    ];
    const income = [{ name: 'Income', icon: 'trending-up' }];
    const rows: TrackCategory[] = [
      ...expense.map<TrackCategory>((c) => ({
        id: prefixedId('cat'),
        name: c.name,
        type: 'expense',
        icon: c.icon,
        archived: false,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      })),
      ...income.map<TrackCategory>((c) => ({
        id: prefixedId('cat'),
        name: c.name,
        type: 'income',
        icon: c.icon,
        archived: false,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      })),
    ];
    await db.trackCategories.bulkPut(rows);
  },

  /** Bulk-replace (used by JSON restore). */
  async replaceAll(categories: TrackCategory[]): Promise<void> {
    const db = getDB();
    await db.trackCategories.clear();
    if (categories.length > 0) await db.trackCategories.bulkPut(categories);
  },
};

export type TrackCategoryRepository = typeof trackCategoryRepository;
