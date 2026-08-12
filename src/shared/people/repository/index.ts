/**
 * Person repository.
 *
 * Repositories are the only place that touch the Dexie
 * `people` table. The Track / Split / Lend modules all
 * read people from this repository indirectly via the
 * shared queries module.
 */

import { getDB } from '@db/database';
import { repoCreate, repoUpdate, repoSoftDelete, repoRestore, type CreateInput } from '@db/repositories/base';
import { PersonSchema, type PersonInput } from '../domain';
import { SELF_PERSON_ID } from '@db/seed';
import { nowISO } from '@shared/dates';
import type { Person } from '@db/schema';

function clean(input: Partial<PersonInput>): Partial<PersonInput> {
  return {
    ...input,
    phone: input.phone || undefined,
    email: input.email || undefined,
    note: input.note || undefined,
  };
}

export const personRepository = {
  /** List active (non-deleted) people, sorted by name then id. */
  async listActive(): Promise<Person[]> {
    const db = getDB();
    const all = await db.people.toArray();
    return all
      .filter((p) => !p.deletedAt)
      .sort((a, b) => {
        if (a.isSelf && !b.isSelf) return -1;
        if (b.isSelf && !a.isSelf) return 1;
        return a.name.localeCompare(b.name);
      });
  },

  /** Get a single person by id. Returns undefined if not found. */
  async get(id: string): Promise<Person | undefined> {
    return getDB().people.get(id);
  },

  /** Create a new person. Throws on invalid input. */
  async create(input: PersonInput): Promise<Person> {
    const parsed = PersonSchema.parse(input);
    const cleaned = clean(parsed);
    return repoCreate<Person>(getDB().people, cleaned as CreateInput<Person>);
  },

  /** Update an existing person. */
  async update(id: string, patch: Partial<PersonInput>): Promise<Person> {
    const parsed = PersonSchema.partial().parse(patch);
    return repoUpdate<Person>(getDB().people, id, clean(parsed));
  },

  /** Soft-delete a person. Self cannot be deleted. */
  async softDelete(id: string): Promise<void> {
    if (id === SELF_PERSON_ID) {
      throw new Error('Cannot delete the self person');
    }
    return repoSoftDelete(getDB().people, id);
  },

  /** Restore a soft-deleted person. */
  async restore(id: string): Promise<void> {
    return repoRestore(getDB().people, id);
  },

  /** Ensure the self Person exists; create if missing. */
  async ensureSelf(): Promise<Person> {
    const db = getDB();
    const existing = await db.people.get(SELF_PERSON_ID);
    if (existing && !existing.deletedAt) return existing;
    const now = nowISO();
    const self: Person = {
      id: SELF_PERSON_ID,
      name: 'Me',
      isSelf: true,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    await db.people.put(self);
    return self;
  },

  /** Bulk-replace all people (used by JSON restore). */
  async replaceAll(people: Person[]): Promise<void> {
    const db = getDB();
    await db.people.clear();
    if (people.length === 0) return;
    await db.people.bulkPut(people);
  },
};
