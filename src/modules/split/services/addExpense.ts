/**
 * addExpense service.
 *
 * Orchestrates the "add expense" use case:
 *   1. Schema-validate the input (via the repository's
 *      `createAtomic` which calls the same Zod schema).
 *   2. Compute per-person share amounts in the Split domain.
 *   3. Persist the expense + payers + shares atomically.
 *
 * The atomic write guarantees that the Split group always
 * has balanced numbers — no expense exists without its
 * payer/share rows, and no payer/share rows exist without
 * their parent expense.
 */

import { splitExpenseRepository } from '../repositories/splitExpenseRepository';
import { splitGroupMemberRepository } from '../repositories/splitGroupMemberRepository';
import type { SplitExpense, SplitPayer, SplitShare } from '@db/schema';
import type { SplitExpenseInput } from '../domain/validation';

export interface AddExpenseResult {
  expense: SplitExpense;
  payers: SplitPayer[];
  shares: SplitShare[];
}

/**
 * Validate, compute, and persist a new Split expense.
 *
 * Side effects:
 *   - any participant in `participantIds` that does not
 *     already have a member row in the group is added as
 *     a new active member (idempotent, work.md §30: "members
 *     can be added implicitly when they participate").
 */
export async function addExpense(input: SplitExpenseInput): Promise<AddExpenseResult> {
  // Ensure every participant has a member row in the group.
  for (const pid of input.participantIds) {
    await splitGroupMemberRepository.getOrCreate(input.groupId, pid);
  }

  return splitExpenseRepository.createAtomic(input);
}
