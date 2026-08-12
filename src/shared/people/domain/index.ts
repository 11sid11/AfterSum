/**
 * Person domain model.
 *
 * A Person is identity only. They do not carry a balance.
 * Balances are computed within financial contexts
 * (Lend ledgers, Split group memberships, etc.).
 */

import { z } from 'zod';
import type { Person } from '@db/schema';

export const PersonSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'Name is required').max(120),
  phone: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email().max(200).optional().or(z.literal('')),
  note: z.string().max(500).optional().or(z.literal('')),
  isSelf: z.boolean().optional(),
});

export type PersonInput = z.infer<typeof PersonSchema>;

/**
 * Make sure that exactly one Person in the set is the
 * "self" user. Used to enforce invariant in repositories.
 */
export function findSelf(people: Person[]): Person | undefined {
  return people.find((p) => p.isSelf && !p.deletedAt);
}
