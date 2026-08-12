/**
 * LendEntry repository.
 *
 * Owns the Dexie `lendEntries` table. The Lend module is
 * the ONLY writer of this table.
 *
 * No "dueDate overdue" computation lives here in V1 — the
 * Lend module deliberately stays decoupled from any
 * scheduling logic. The schema accepts a `dueDate` for
 * future use.
 */

import { getDB } from '@db/database';
import {
  repoCreate,
  repoUpdate,
  repoSoftDelete,
  repoRestore,
  type CreateInput,
} from '@db/repositories/base';
import { LendEntryInputSchema, LendEntryTypeSchema, type LendEntryInput } from '../domain/validation';
import { magnitudeToStoredAmount } from '../domain/signs';
import type { LendEntry } from '@db/schema';

function clean(input: Partial<LendEntryInput>): Partial<LendEntryInput> {
  const out: Partial<LendEntryInput> = { ...input };
  if (typeof out.note === 'string' && out.note === '') delete out.note;
  if (typeof out.dueDate === 'string' && out.dueDate === '') delete out.dueDate;
  return out;
}

export const lendEntryRepository = {
  /** All entries (active + deleted) across all ledgers. */
  async list(): Promise<LendEntry[]> {
    return getDB().lendEntries.toArray();
  },

  /** Active entries for a single ledger, sorted by date desc. */
  async listForLedger(ledgerId: string): Promise<LendEntry[]> {
    const all = await getDB().lendEntries.where('ledgerId').equals(ledgerId).toArray();
    return all
      .filter((e) => !e.deletedAt)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
  },

  /** Active entries for a person (across all of their ledgers). */
  async listForPerson(personId: string): Promise<LendEntry[]> {
    const db = getDB();
    const ledgers = await db.lendLedgers.toArray();
    const ledgerIds = new Set(
      ledgers.filter((l) => l.personId === personId && !l.deletedAt).map((l) => l.id),
    );
    if (ledgerIds.size === 0) return [];
    const out: LendEntry[] = [];
    for (const lid of ledgerIds) {
      const entries = await db.lendEntries.where('ledgerId').equals(lid).toArray();
      for (const e of entries) {
        if (!e.deletedAt) out.push(e);
      }
    }
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
    return out;
  },

  /** Get a single entry by id. */
  async get(id: string): Promise<LendEntry | undefined> {
    return getDB().lendEntries.get(id);
  },

  /**
   * Create a new entry. The schema enforces the magnitude /
   * sign rules. The stored `amountMinor` is the magnitude
   * for non-adjustment types; for `adjustment` the stored
   * value is the user-supplied signed amount.
   */
  async create(input: LendEntryInput): Promise<LendEntry> {
    const parsed = LendEntryInputSchema.parse(input);
    const cleaned = clean(parsed) as LendEntryInput;
    const storedAmount = magnitudeToStoredAmount(cleaned.type, cleaned.amountMinor);
    const toCreate: CreateInput<LendEntry> = {
      ledgerId: cleaned.ledgerId,
      type: cleaned.type,
      amountMinor: storedAmount,
      date: cleaned.date,
      dueDate: cleaned.dueDate || undefined,
      note: cleaned.note || undefined,
    };
    return repoCreate<LendEntry>(getDB().lendEntries, toCreate);
  },

  /**
   * Update an entry. The same magnitude/sign rules apply
   * to the patch.
   */
  async update(id: string, patch: Partial<LendEntryInput>): Promise<LendEntry> {
    // We can't call .partial() on the refined schema
    // directly (superRefine blocks it), so we do a
    // shape-level validation per field instead.
    const cleaned = clean(patch);
    if (typeof cleaned.ledgerId === 'string' && cleaned.ledgerId.length === 0) {
      throw new Error('Ledger is required');
    }
    if (typeof cleaned.type === 'string' && !LendEntryTypeSchema.safeParse(cleaned.type).success) {
      throw new Error('Invalid entry type');
    }
    if (cleaned.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(cleaned.date)) {
      throw new Error('Date must be YYYY-MM-DD');
    }
    if (
      cleaned.dueDate !== undefined &&
      typeof cleaned.dueDate === 'string' &&
      cleaned.dueDate !== '' &&
      !/^\d{4}-\d{2}-\d{2}$/.test(cleaned.dueDate)
    ) {
      throw new Error('Due date must be YYYY-MM-DD');
    }
    if (cleaned.amountMinor !== undefined) {
      if (!Number.isInteger(cleaned.amountMinor)) {
        throw new Error('Amount must be an integer (minor units)');
      }
      if (cleaned.amountMinor === 0) {
        throw new Error('Amount must not be zero');
      }
      if (cleaned.type !== 'adjustment' && cleaned.amountMinor < 0) {
        throw new Error('Amount must be positive for this entry type');
      }
    }

    const patchWithStored: Partial<LendEntry> = {};
    if (cleaned.ledgerId !== undefined) patchWithStored.ledgerId = cleaned.ledgerId;
    if (cleaned.type !== undefined) patchWithStored.type = cleaned.type;
    if (cleaned.date !== undefined) patchWithStored.date = cleaned.date;
    if (cleaned.dueDate !== undefined)
      patchWithStored.dueDate = cleaned.dueDate || undefined;
    if (cleaned.note !== undefined) patchWithStored.note = cleaned.note || undefined;
    if (cleaned.amountMinor !== undefined && cleaned.type !== undefined) {
      patchWithStored.amountMinor = magnitudeToStoredAmount(cleaned.type, cleaned.amountMinor);
    } else if (cleaned.amountMinor !== undefined) {
      // type not provided in patch: we must re-normalize
      // using the existing type.
      const cur = await this.get(id);
      if (cur) {
        patchWithStored.amountMinor = magnitudeToStoredAmount(cur.type, cleaned.amountMinor);
      } else {
        patchWithStored.amountMinor = cleaned.amountMinor;
      }
    }
    return repoUpdate<LendEntry>(getDB().lendEntries, id, patchWithStored);
  },

  /** Soft-delete an entry. */
  async softDelete(id: string): Promise<void> {
    return repoSoftDelete(getDB().lendEntries, id);
  },

  /** Restore a soft-deleted entry. */
  async restore(id: string): Promise<void> {
    return repoRestore(getDB().lendEntries, id);
  },

  /** Bulk replace (used by JSON restore). */
  async replaceAll(entries: LendEntry[]): Promise<void> {
    const db = getDB();
    await db.lendEntries.clear();
    if (entries.length > 0) await db.lendEntries.bulkPut(entries);
  },
};

export type LendEntryRepository = typeof lendEntryRepository;
