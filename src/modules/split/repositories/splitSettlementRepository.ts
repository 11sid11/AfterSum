/**
 * SplitSettlement repository.
 *
 * Settlements are direct "X paid Y" transfers recorded
 * against a single Split group. They affect the balance
 * formula (`+sent -received`) and never touch any other
 * module.
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
import { SplitSettlementInputSchema, type SplitSettlementInput, assertSettlementInvariants } from '../domain/validation';
import type { SplitSettlement } from '@db/schema';

function clean(input: Partial<SplitSettlementInput>): Partial<SplitSettlementInput> {
  return {
    ...input,
    note: input.note || undefined,
  };
}

export const splitSettlementRepository = {
  /** All non-deleted settlements. */
  async list(): Promise<SplitSettlement[]> {
    const all = await getDB().splitSettlements.toArray();
    return all
      .filter((s) => !s.deletedAt)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  /** All non-deleted settlements for a group. */
  async listForGroup(groupId: string): Promise<SplitSettlement[]> {
    const all = await getDB().splitSettlements.where('groupId').equals(groupId).toArray();
    return all
      .filter((s) => !s.deletedAt)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  /** Single settlement by id. */
  async get(id: string): Promise<SplitSettlement | undefined> {
    return getDB().splitSettlements.get(id);
  },

  /**
   * Create a new settlement. Validates amount > 0 and
   * `from !== to` via {@link assertSettlementInvariants}.
   */
  async create(input: SplitSettlementInput): Promise<SplitSettlement> {
    const parsed = SplitSettlementInputSchema.parse(input);
    assertSettlementInvariants(parsed);
    const cleaned = clean(parsed);
    return repoCreate<SplitSettlement>(getDB().splitSettlements, cleaned as CreateInput<SplitSettlement>);
  },

  async update(id: string, patch: Partial<Omit<SplitSettlementInput, 'groupId'>>): Promise<SplitSettlement> {
    const parsed = SplitSettlementInputSchema.partial().parse(patch);
    return repoUpdate<SplitSettlement>(getDB().splitSettlements, id, clean(parsed));
  },

  async softDelete(id: string): Promise<void> {
    return repoSoftDelete(getDB().splitSettlements, id);
  },

  async restore(id: string): Promise<void> {
    return repoRestore(getDB().splitSettlements, id);
  },

  async _hardDelete(id: string): Promise<void> {
    return repoHardDelete(getDB().splitSettlements, id);
  },

  async replaceAll(settlements: SplitSettlement[]): Promise<void> {
    const db = getDB();
    await db.splitSettlements.clear();
    if (settlements.length > 0) await db.splitSettlements.bulkPut(settlements);
  },
};

export type SplitSettlementRepository = typeof splitSettlementRepository;
