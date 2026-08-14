/**
 * Person repository.
 *
 * People are shared identities used by Split and Lend. Referenced
 * people cannot be removed from active data because doing so would
 * make existing balances and histories harder to understand.
 */

import { getDB } from '@db/database';
import { repoCreate, repoUpdate, repoSoftDelete, repoRestore, type CreateInput } from '@db/repositories/base';
import {
  PersonSchema,
  normalizePersonName,
  personNameKey,
  type PersonInput,
} from '../domain';
import { SELF_PERSON_ID } from '@db/seed';
import { nowISO } from '@shared/dates';
import type { Person } from '@db/schema';

function clean(input: Partial<PersonInput>): Partial<PersonInput> {
  const cleaned: Partial<PersonInput> = {
    ...input,
    phone: input.phone || undefined,
    email: input.email || undefined,
    note: input.note || undefined,
  };
  if (input.name !== undefined) cleaned.name = normalizePersonName(input.name);
  return cleaned;
}

async function assertUniqueActiveName(name: string, exceptId?: string): Promise<void> {
  const key = personNameKey(name);
  const duplicate = (await getDB().people.toArray()).find(
    (person) => !person.deletedAt && person.id !== exceptId && personNameKey(person.name) === key,
  );

  if (duplicate) {
    throw new Error(`A person named “${duplicate.name}” already exists. Choose a unique name.`);
  }
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
    const parsed = PersonSchema.parse(clean(input));
    await assertUniqueActiveName(parsed.name);
    return repoCreate<Person>(getDB().people, parsed as CreateInput<Person>);
  },

  async update(id: string, patch: Partial<PersonInput>): Promise<Person> {
    const parsed = PersonSchema.partial().parse(clean(patch));
    if (parsed.name !== undefined) await assertUniqueActiveName(parsed.name, id);
    return repoUpdate<Person>(getDB().people, id, parsed);
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
    const person = await getDB().people.get(id);
    if (!person) return;
    await assertUniqueActiveName(person.name, id);
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
