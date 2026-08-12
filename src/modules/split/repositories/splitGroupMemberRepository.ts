/**
 * SplitGroupMember repository.
 *
 * Owns the Dexie `splitGroupMembers` table. A member row
 * joins a person to a SplitGroup. `active=false` keeps the
 * history intact while hiding them from new expenses.
 */

import { getDB } from '@db/database';
import {
  repoCreate,
  repoUpdate,
  repoSoftDelete,
  repoRestore,
  type CreateInput,
} from '@db/repositories/base';
import type { SplitGroupMember } from '@db/schema';
import { nowISO } from '@shared/dates';

export const splitGroupMemberRepository = {
  /** All members for a group (any active state), excluding soft-deleted. */
  async listForGroup(groupId: string): Promise<SplitGroupMember[]> {
    const all = await getDB().splitGroupMembers.where('groupId').equals(groupId).toArray();
    return all
      .filter((m) => !m.deletedAt)
      .sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : 1));
  },

  /** Only `active=true` members for a group. */
  async listActiveForGroup(groupId: string): Promise<SplitGroupMember[]> {
    const all = await this.listForGroup(groupId);
    return all.filter((m) => m.active);
  },

  /** Single member row by id. */
  async get(id: string): Promise<SplitGroupMember | undefined> {
    return getDB().splitGroupMembers.get(id);
  },

  /**
   * Idempotent add. If a member row for (group, person)
   * already exists (active or not), it is reused. If the
   * existing row is soft-deleted, it is restored and
   * reactivated. Otherwise a fresh row is inserted.
   */
  async getOrCreate(groupId: string, personId: string): Promise<SplitGroupMember> {
    const db = getDB();
    const existing = await db.splitGroupMembers
      .where('[groupId+personId]')
      .equals([groupId, personId])
      .first();
    if (existing) {
      if (existing.deletedAt) {
        await repoRestore(db.splitGroupMembers, existing.id);
        return this.update(existing.id, { active: true });
      }
      if (!existing.active) {
        return this.update(existing.id, { active: true });
      }
      return existing;
    }
    return this.create({ groupId, personId });
  },

  /** Create a new member row. */
  async create(input: { groupId: string; personId: string; active?: boolean }): Promise<SplitGroupMember> {
    const row: CreateInput<SplitGroupMember> = {
      groupId: input.groupId,
      personId: input.personId,
      active: input.active ?? true,
      joinedAt: nowISO(),
    };
    return repoCreate<SplitGroupMember>(getDB().splitGroupMembers, row);
  },

  /** Update an existing row. */
  async update(id: string, patch: Partial<Omit<SplitGroupMember, 'id' | 'createdAt' | 'revision' | 'groupId' | 'personId'>>): Promise<SplitGroupMember> {
    return repoUpdate<SplitGroupMember>(getDB().splitGroupMembers, id, patch);
  },

  /** Flip `active` for a member. */
  async setActive(id: string, active: boolean): Promise<SplitGroupMember> {
    return this.update(id, { active });
  },

  /** Soft-delete. Use `setActive(false)` if you want to keep history. */
  async softDelete(id: string): Promise<void> {
    return repoSoftDelete(getDB().splitGroupMembers, id);
  },

  /** Restore a soft-deleted member. */
  async restore(id: string): Promise<void> {
    return repoRestore(getDB().splitGroupMembers, id);
  },

  /**
   * Replace the full member list for a group. Existing
   * members not in `memberIds` are soft-deleted; existing
   * members in the list are kept (or reactivated); new
   * members are inserted. Used by the group settings page.
   */
  async replaceAllForGroup(groupId: string, memberIds: string[]): Promise<void> {
    const db = getDB();
    await db.transaction('rw', db.splitGroupMembers, async () => {
      const existing = await db.splitGroupMembers.where('groupId').equals(groupId).toArray();
      const want = new Set(memberIds);
      for (const m of existing) {
        const present = want.has(m.personId);
        if (present) {
          if (m.deletedAt) {
            await repoRestore(db.splitGroupMembers, m.id);
          }
          if (!m.active) {
            await this.setActive(m.id, true);
          }
          want.delete(m.personId);
        } else {
          // If still active, deactivate (keep history).
          if (!m.deletedAt && m.active) {
            await this.setActive(m.id, false);
          }
        }
      }
      for (const personId of want) {
        await this.create({ groupId, personId, active: true });
      }
    });
  },
};

export type SplitGroupMemberRepository = typeof splitGroupMemberRepository;
