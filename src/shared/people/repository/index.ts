/**
 * Person repository.
 *
 * People are shared identities used by Split and Lend. Referenced
 * people cannot be removed from active data because doing so would
 * make existing balances and histories harder to understand.
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

  async get(id: string): Promise<Person | undefined> {
    return getDB().people.get(id);
  },

  async create(input: PersonInput): Promise<Person> {
    const parsed = PersonSchema.parse(input);
    const cleaned = clean(parsed);
    return repoCreate<Person>(getDB().people, cleaned as CreateInput<Person>);
  },

  async update(id: string, patch: Partial<PersonInput>): Promise<Person> {
    const parsed = PersonSchema.partial().parse(patch);
    return repoUpdate<Person>(getDB().people, id, clean(parsed));
  },

  async softDelete(id: string): Promise<void> {
    if (id === SELF_PERSON_ID) throw new Error('Cannot delete the self person');
    const db = getDB();
    const [splitMemberships, lendLedgers] = await Promise.all([
      db.splitGroupMembers.where('personId').equals(id).count(),
      db.lendLedgers.where('personId').equals(id).count(),
    ]);
    if (splitMemberships + lendLedgers > 0) {
      throw new Error('This person has financial history and cannot be removed. Rename them instead.');
    }
    return repoSoftDelete(db.people, id);
  },

  async restore(id: string): Promise<void> {
    return repoRestore(getDB().people, id);
  },

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

  async replaceAll(people: Person[]): Promise<void> {
    const db = getDB();
    await db.people.clear();
    if (people.length === 0) return;
    await db.people.bulkPut(people);
  },
};
