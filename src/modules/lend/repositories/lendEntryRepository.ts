/**
 * LendEntry repository.
 *
 * Owns the Dexie `lendEntries` table. The Lend module is
 * the ONLY writer of this table.
 */

import { getDB } from '@db/database';
import {
  repoCreate,
  repoUpdate,
  repoSoftDelete,
  repoRestore,
  type CreateInput,
} from '@db/repositories/base';
import { isValidDateOnly } from '@shared/dates';
import { LendEntryInputSchema, LendEntryTypeSchema, type LendEntryInput } from '../domain/validation';
import { magnitudeToStoredAmount } from '../domain/signs';
import type { LendEntry } from '@db/schema';

function clean(input: Partial<LendEntryInput>): Partial<LendEntryInput> {
  const out: Partial<LendEntryInput> = { ...input };
  if (typeof out.note === 'string' && out.note === '') out.note = undefined;
  if (typeof out.dueDate === 'string' && out.dueDate === '') out.dueDate = undefined;
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

  /** Create a new validated Lend event. */
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

  /** Update an entry while validating the resulting event, not only the patch. */
  async update(id: string, patch: Partial<LendEntryInput>): Promise<LendEntry> {
    const current = await this.get(id);
    if (!current) throw new Error(`Lend entry not found: ${id}`);

    const cleaned = clean(patch);
    if (typeof cleaned.ledgerId === 'string' && cleaned.ledgerId.length === 0) {
      throw new Error('Ledger is required');
    }
    if (typeof cleaned.type === 'string' && !LendEntryTypeSchema.safeParse(cleaned.type).success) {
      throw new Error('Invalid entry type');
    }
    if (cleaned.date !== undefined && !isValidDateOnly(cleaned.date)) {
      throw new Error('Invalid calendar date');
    }
    if (cleaned.dueDate !== undefined && !isValidDateOnly(cleaned.dueDate)) {
      throw new Error('Invalid due date');
    }

    const resultingType = cleaned.type ?? current.type;
    const resultingAmount = cleaned.amountMinor ?? current.amountMinor;
    if (!Number.isSafeInteger(resultingAmount) || resultingAmount === 0) {
      throw new Error('Amount must be a non-zero safe integer in minor units');
    }
    if (resultingType !== 'adjustment' && resultingAmount < 0) {
      throw new Error('Amount must be positive for this entry type');
    }

    const patchWithStored: Partial<LendEntry> = {};
    if (cleaned.ledgerId !== undefined) patchWithStored.ledgerId = cleaned.ledgerId;
    if (cleaned.type !== undefined) patchWithStored.type = cleaned.type;
    if (cleaned.date !== undefined) patchWithStored.date = cleaned.date;
    if (Object.hasOwn(patch, 'dueDate')) patchWithStored.dueDate = cleaned.dueDate || undefined;
    if (Object.hasOwn(patch, 'note')) patchWithStored.note = cleaned.note || undefined;
    if (cleaned.amountMinor !== undefined) {
      patchWithStored.amountMinor = magnitudeToStoredAmount(resultingType, cleaned.amountMinor);
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
