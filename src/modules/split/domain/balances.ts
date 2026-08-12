/**
 * Split balance engine.
 *
 * Per the spec (work.md §37), a member's group balance is:
 *
 *   balance
 *   = payments_made
 *   - allocated_shares
 *   + settlements_sent
 *   - settlements_received
 *
 * Sign convention: positive = "should receive", negative = "owes".
 *
 * Module independence: this file is pure. It does not import
 * from Track, Lend, or the Dexie database. The repository /
 * query layer is responsible for fetching the rows.
 */

import type { SplitExpense, SplitGroup, SplitPayer, SplitSettlement, SplitShare, SplitGroupMember } from '@db/schema';
import { sumMinor } from '@shared/money';

export type BalanceMap = Map<string, number>;

export interface BalanceInputs {
  group: SplitGroup;
  members: SplitGroupMember[];
  expenses: SplitExpense[];
  payers: SplitPayer[];
  shares: SplitShare[];
  settlements: SplitSettlement[];
}

/**
 * Compute balances for a group's active members. Inactive
 * members are not returned in the map; their historical
 * contributions still affect the active members' balances.
 *
 * Returns a `Map<personId, balanceMinor>`. Members with no
 * activity are still present with balance 0, so the UI can
 * render them as "Settled" without a separate lookup.
 */
export function computeGroupBalances(inputs: BalanceInputs): BalanceMap {
  return computeBalances(inputs, false);
}

/**
 * Same as {@link computeGroupBalances} but also returns
 * balances for inactive members (historic context).
 */
export function computeMemberBalances(inputs: BalanceInputs): BalanceMap {
  return computeBalances(inputs, true);
}

function computeBalances(inputs: BalanceInputs, includeInactive: boolean): BalanceMap {
  const { group: _group, members, expenses, payers, shares, settlements } = inputs;
  void _group;

  // Index by expenseId for O(1) lookups.
  const payersByExpense = new Map<string, SplitPayer[]>();
  for (const p of payers) {
    if (p.deletedAt) continue;
    const list = payersByExpense.get(p.expenseId) ?? [];
    list.push(p);
    payersByExpense.set(p.expenseId, list);
  }
  const sharesByExpense = new Map<string, SplitShare[]>();
  for (const s of shares) {
    if (s.deletedAt) continue;
    const list = sharesByExpense.get(s.expenseId) ?? [];
    list.push(s);
    sharesByExpense.set(s.expenseId, list);
  }

  // Soft-deleted expenses contribute nothing.
  const activeExpenseIds = new Set(
    expenses.filter((e) => !e.deletedAt).map((e) => e.id),
  );

  // Build the initial balance map for every (included) member.
  const balances = new Map<string, number>();
  for (const m of members) {
    if (!m.deletedAt && (includeInactive || m.active)) {
      balances.set(m.personId, 0);
    }
  }

  // payments_made: +sum of all payer rows for active expenses.
  for (const [expenseId, list] of payersByExpense) {
    if (!activeExpenseIds.has(expenseId)) continue;
    for (const p of list) {
      balances.set(p.personId, (balances.get(p.personId) ?? 0) + p.amountMinor);
    }
  }

  // allocated_shares: -sum of all share rows for active expenses.
  for (const [expenseId, list] of sharesByExpense) {
    if (!activeExpenseIds.has(expenseId)) continue;
    for (const s of list) {
      balances.set(s.personId, (balances.get(s.personId) ?? 0) - s.amountMinor);
    }
  }

  // settlements: +sent, -received. Only consider non-deleted
  // settlements in the same group.
  for (const s of settlements) {
    if (s.deletedAt) continue;
    if (s.groupId !== inputs.group.id) continue;
    // Sender's "owes" decreases — they have transferred
    // money out — so we add to their balance.
    balances.set(s.fromPersonId, (balances.get(s.fromPersonId) ?? 0) + s.amountMinor);
    // Receiver's "should receive" decreases — they have
    // received money — so we subtract from their balance.
    balances.set(s.toPersonId, (balances.get(s.toPersonId) ?? 0) - s.amountMinor);
  }

  // Defensive: the total across all balances within a single
  // currency should be 0 (the system is closed). We don't
  // assert here because some members may have been excluded
  // from the map (e.g. inactive in the active-only variant).
  void sumMinor;

  return balances;
}

/**
 * Format helper: returns a single net total for a member
 * (useful for the dashboard "You're owed / You owe" card).
 */
export function memberNet(balances: BalanceMap, personId: string): number {
  return balances.get(personId) ?? 0;
}

/**
 * Build a per-person breakdown for the group landing screen:
 *   "Rahul owes you ₹1,400"  /  "You owe Aman ₹900"
 *
 * Returned list is sorted by absolute balance descending so
 * the most impactful relationships appear first.
 */
export interface PersonBalanceRow {
  personId: string;
  amountMinor: number;
  direction: 'owes' | 'is_owed' | 'settled';
}

export function balancesByPerson(balances: BalanceMap): PersonBalanceRow[] {
  const out: PersonBalanceRow[] = [];
  for (const [personId, amountMinor] of balances) {
    out.push({
      personId,
      amountMinor,
      direction: amountMinor > 0 ? 'is_owed' : amountMinor < 0 ? 'owes' : 'settled',
    });
  }
  out.sort((a, b) => Math.abs(b.amountMinor) - Math.abs(a.amountMinor));
  return out;
}
