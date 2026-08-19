import { beforeEach, describe, expect, it } from 'vitest';
import { freshDB, wipeDB } from '@tests/db-test-utils';
import { getDB } from '@db/database';
import { personRepository } from '@shared/people/repository';
import { createSplitTrip } from './createTrip';

beforeEach(async () => {
  await wipeDB();
  freshDB();
});

describe('createSplitTrip', () => {
  it('creates the trip and all memberships atomically', async () => {
    const self = await personRepository.ensureSelf();
    const saved = await personRepository.create({ name: 'Rahul' });

    const group = await createSplitTrip({
      name: 'Goa Trip',
      currency: 'INR',
      selfPersonId: self.id,
      memberPersonIds: [saved.id],
      newPersonNames: ['Priya'],
    });

    expect(await getDB().splitGroups.count()).toBe(1);
    const members = await getDB().splitGroupMembers.where('groupId').equals(group.id).toArray();
    expect(members).toHaveLength(3);
    expect((await getDB().people.toArray()).map((person) => person.name).sort()).toEqual([
      'Me',
      'Priya',
      'Rahul',
    ]);
  });

  it('rolls back the group and memberships when a new person cannot be created', async () => {
    const self = await personRepository.ensureSelf();
    await personRepository.create({ name: 'Rahul' });

    await expect(
      createSplitTrip({
        name: 'Goa Trip',
        currency: 'INR',
        selfPersonId: self.id,
        memberPersonIds: [],
        newPersonNames: ['Rahul'],
      }),
    ).rejects.toThrow(/already exists/i);

    expect(await getDB().splitGroups.count()).toBe(0);
    expect(await getDB().splitGroupMembers.count()).toBe(0);
    expect(await getDB().people.count()).toBe(2);
  });
});
