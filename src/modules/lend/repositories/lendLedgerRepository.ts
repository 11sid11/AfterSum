/**
 * LendLedger repository.
 *
 * Owns the Dexie `lendLedgers` table. The Lend module is the
 * ONLY writer of this table.
 *
 * Important: `getOrCreate(personId, currency)` is idempotent
 * — it returns the existing active ledger for the pair, or
 * creates a fresh one. This is the canonical way the UI
 * resolves a ledger to write an entry into.
 */

import { getDB } from '@db/database';
import { runTransaction } from '@db/transaction';
import {
  repoCreate,
  repoUpdate,
  repoRestore,
  type CreateInput,
} from '@db/repositories/base';
import { nowISO } from '@shared/dates';
import { LendLedgerInputSchema, type LendLedgerInput } from '../domain/validation';
import type { LendLedger, LendEntry } from '@db/schema';

function clean(input: Partial<LendLedgerInput>): Partial<LendLedgerInput> {
  return {
    ...input,
    label: input.label || undefined,
  };
}

export const lendLedgerRepository = {
  /** All active, non-archived ledgers, sorted by createdAt asc. */
  async list(): Promise<LendLedger[]> {
    const all = await getDB().lendLedgers.toArray();
    return all
      .filter((l) => !l.deletedAt && !l.archived)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  },

  /** All active, non-archived ledgers for a person. */
  async listForPerson(personId: string): Promise<LendLedger[]> {
    const all = await getDB().lendLedgers.where('personId').equals(personId).toArray();
    return all
      .filter((l) => !l.deletedAt && !l.archived)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  },

  /** Get a single ledger by id. */
  async get(id: string): Promise<LendLedger | undefined> {
    return getDB().lendLedgers.get(id);
  },

  /**
   * Get the active ledger for (person, currency), or create
   * one if it doesn't exist. The lookup and creation share a
   * write transaction so concurrent callers cannot create two
   * active ledgers for the same pair.
   */
  async getOrCreate(personId: string, currency: string): Promise<LendLedger> {
    const db = getDB();
    return db.transaction('rw', db.lendLedgers, async () => {
      const existing = await db.lendLedgers
        .where('[personId+currency]')
        .equals([personId, currency])
        .filter((ledger) => !ledger.deletedAt && !ledger.archived)
        .first();
      if (existing) return existing;

      const parsed = LendLedgerInputSchema.parse({ personId, currency, archived: false });
      return repoCreate<LendLedger>(db.lendLedgers, clean(parsed) as CreateInput<LendLedger>);
    });
  },

  /** Create a new ledger. */
  async create(input: LendLedgerInput): Promise<LendLedger> {
    const parsed = LendLedgerInputSchema.parse(input);
    const cleaned = clean(parsed);
    return repoCreate<LendLedger>(getDB().lendLedgers, cleaned as CreateInput<LendLedger>);
  },

  /** Update an existing ledger. */
  async update(id: string, patch: Partial<LendLedgerInput>): Promise<LendLedger> {
    const parsed = LendLedgerInputSchema.partial().parse(patch);
    return repoUpdate<LendLedger>(getDB().lendLedgers, id, clean(parsed));
  },

  /**
   * Archive a ledger (logical flag). The ledger and its
   * entries remain queryable but are excluded from
   * dashboard summaries and future quick-entry resolution.
   */
  async archive(id: string): Promise<LendLedger> {
    return this.update(id, { archived: true });
  },

  /**
   * Soft-delete a ledger and all entries that are active at that moment.
   * One deletion timestamp is shared by the cascade so Undo can restore only
   * rows deleted by this operation, never entries the user deleted earlier.
   */
  async softDelete(id: string): Promise<{ ledgerId: string; entryIds: string[] }> {
    const db = getDB();
    return db.transaction('rw', [db.lendLedgers, db.lendEntries], async () => {
      const ledger = await db.lendLedgers.get(id);
      if (!ledger) return { ledgerId: id, entryIds: [] };
      const entries = await db.lendEntries.where('ledgerId').equals(id).toArray();
      const activeEntries = entries.filter((entry) => !entry.deletedAt);
      const deletedAt = nowISO();

      await db.lendLedgers.put({
        ...ledger,
        deletedAt,
        updatedAt: deletedAt,
        revision: ledger.revision + 1,
      });
      for (const entry of activeEntries) {
        await db.lendEntries.put({
          ...entry,
          deletedAt,
          updatedAt: deletedAt,
          revision: entry.revision + 1,
        });
      }
      return { ledgerId: id, entryIds: activeEntries.map((entry) => entry.id) };
    });
  },

  /** Restore a soft-deleted ledger and only entries deleted with that ledger. */
  async restore(id: string): Promise<{ ledgerId: string; entryIds: string[] }> {
    const db = getDB();
    return db.transaction('rw', [db.lendLedgers, db.lendEntries], async () => {
      const ledger = await db.lendLedgers.get(id);
      if (!ledger) return { ledgerId: id, entryIds: [] };
      const deletedAt = ledger.deletedAt;
      const entries = deletedAt
        ? (await db.lendEntries.where('ledgerId').equals(id).toArray()).filter(
            (entry) => entry.deletedAt === deletedAt,
          )
        : [];

      await repoRestore(db.lendLedgers, id);
      for (const entry of entries) {
        await repoRestore(db.lendEntries, entry.id);
      }
      return { ledgerId: id, entryIds: entries.map((entry) => entry.id) };
    });
  },

  /** Hard-delete a ledger and all of its entries atomically. */
  async _hardDeleteCascade(id: string): Promise<void> {
    const db = getDB();
    await db.transaction('rw', [db.lendLedgers, db.lendEntries], async () => {
      await db.lendEntries.where('ledgerId').equals(id).delete();
      await db.lendLedgers.delete(id);
    });
  },

  /** Bulk-replace (used by JSON restore). */
  async replaceAll(ledgers: LendLedger[], entries: LendEntry[]): Promise<void> {
    const db = getDB();
    await runTransaction(['lendLedgers', 'lendEntries'], 'readwrite', async () => {
      await db.lendLedgers.clear();
      await db.lendEntries.clear();
      if (ledgers.length > 0) await db.lendLedgers.bulkPut(ledgers);
      if (entries.length > 0) await db.lendEntries.bulkPut(entries);
    });
  },
};

export type LendLedgerRepository = typeof lendLedgerRepository;
