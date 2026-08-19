import { getDB } from '@db/database';
import type { SplitGroup } from '@db/schema';
import { personRepository } from '@shared/people/repository';
import { splitGroupMemberRepository } from '../repositories/splitGroupMemberRepository';
import { splitGroupRepository } from '../repositories/splitGroupRepository';

export interface CreateSplitTripInput {
  name: string;
  description?: string;
  currency: string;
  selfPersonId: string;
  memberPersonIds: string[];
  newPersonNames: string[];
}

/** Create a trip, any new people, and all memberships as one user operation. */
export async function createSplitTrip(input: CreateSplitTripInput): Promise<SplitGroup> {
  const db = getDB();
  return db.transaction(
    'rw',
    [db.people, db.splitGroups, db.splitGroupMembers],
    async () => {
      const group = await splitGroupRepository.create({
        name: input.name,
        description: input.description,
        currency: input.currency,
      });

      await splitGroupMemberRepository.getOrCreate(group.id, input.selfPersonId);
      for (const personId of new Set(input.memberPersonIds)) {
        if (personId !== input.selfPersonId) {
          await splitGroupMemberRepository.getOrCreate(group.id, personId);
        }
      }
      for (const personName of input.newPersonNames) {
        const person = await personRepository.create({ name: personName });
        await splitGroupMemberRepository.getOrCreate(group.id, person.id);
      }

      return group;
    },
  );
}
