/**
 * Split aggregations.
 *
 * High-level derived numbers used by the group landing screen
 * and the dashboard. All functions are pure; the caller
 * (query layer) supplies the rows.
 *
 * Module independence: this file does not import Track or
 * Lend, so the functions can be safely reused by Overview
 * later.
 */

import type {
  SplitExpense,
  SplitGroup,
  SplitGroupMember,
  SplitPayer,
  SplitSettlement,
  SplitShare,
} from '@db/schema';
import { computeGroupBalances, type BalanceMap } from './balances';
import { simplifyDebts, type Transfer } from './simplify';
import { sumMinor } from '@shared/money';

export interface GroupAggregateInputs {
  group: SplitGroup;
  members: SplitGroupMember[];
  expenses: SplitExpense[];
  payers: SplitPayer[];
  shares: SplitShare[];
  settlements: SplitSettlement[];
  selfPersonId?: string;
}

/** Total amount of money spent in the group (sum of all active expenses). */
export function groupSpendingTotal(input: GroupAggregateInputs): number {
  return sumMinor(
    input.expenses
      .filter((e) => !e.deletedAt)
      .map((e) => e.amountMinor),
  );
}

/** The current user's allocated share of the group's total. */
export function myShare(input: GroupAggregateInputs): number {
  const self = input.selfPersonId;
  if (!self) return 0;
  return sumMinor(
    input.shares
      .filter((s) => !s.deletedAt)
      .filter((s) => s.personId === self)
      .map((s) => s.amountMinor),
  );
}

/** The current user's total payments to the group. */
export function myPaid(input: GroupAggregateInputs): number {
  const self = input.selfPersonId;
  if (!self) return 0;
  return sumMinor(
    input.payers
      .filter((p) => !p.deletedAt)
      .filter((p) => p.personId === self)
      .map((p) => p.amountMinor),
  );
}

/** The current user's net position in the group. Positive = should receive. */
export function myNet(input: GroupAggregateInputs): number {
  const self = input.selfPersonId;
  if (!self) return 0;
  const balances = computeGroupBalances(input);
  return balances.get(self) ?? 0;
}

export interface GroupSummary {
  totalSpent: number;
  yourShare: number;
  youPaid: number;
  youreOwed: number;
  yourNet: number;
  balances: BalanceMap;
  transfers: Transfer[];
  recent: SplitExpense[];
}

/** All the high-level numbers the group landing screen needs. */
export function buildGroupSummary(
  input: GroupAggregateInputs,
  opts: { selfPersonId?: string; recentLimit?: number } = {},
): GroupSummary {
  const selfPersonId = opts.selfPersonId ?? input.selfPersonId;
  const balances = computeGroupBalances(input);
  const transfers = simplifyDebts(balances);
  const yourNet = selfPersonId ? balances.get(selfPersonId) ?? 0 : 0;
  const youreOwed = yourNet > 0 ? yourNet : 0;
  return {
    totalSpent: groupSpendingTotal(input),
    yourShare: myShare({ ...input, selfPersonId }),
    youPaid: myPaid({ ...input, selfPersonId }),
    youreOwed,
    yourNet,
    balances,
    transfers,
    recent: input.expenses
      .filter((e) => !e.deletedAt)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, opts.recentLimit ?? 5),
  };
}
