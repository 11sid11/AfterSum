/**
 * Split live queries.
 *
 * `useLiveQuery`-backed hooks for Split. Components import
 * from this file rather than from the repositories so the
 * React data flow is uniform and changes propagate
 * automatically.
 *
 * Module independence: these hooks only read Split tables
 * (and the shared `people` table via the shared hook).
 * They never read Track or Lend.
 */

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import { findSelf } from '@shared/people/domain';
import type {
  SplitGroup,
  SplitGroupMember,
  SplitExpense,
  SplitSettlement,
  SplitPayer,
  SplitShare,
} from '@db/schema';
import { computeGroupBalances } from '../domain/balances';
import { simplifyDebts, type Transfer } from '../domain/simplify';
import { buildGroupSummary, type GroupSummary } from '../domain/aggregations';
import { useSelf } from '@shared/people/queries';

// ---------------------------------------------------------------------------
// Single-table hooks
// ---------------------------------------------------------------------------

/** All active, non-archived groups (the dashboard list). */
export function useSplitGroups(): SplitGroup[] | undefined {
  return useLiveQuery(async () => {
    const all = await getDB().splitGroups.toArray();
    return all
      .filter((g) => !g.deletedAt && !g.archived)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, []);
}

/** Single group by id (undefined while loading). */
export function useSplitGroup(id: string | undefined): SplitGroup | undefined {
  return useLiveQuery(
    async () => (id ? getDB().splitGroups.get(id) : undefined),
    [id],
  );
}

/**
 * Members of a group. Pass `includeInactive=true` to keep
 * historic members in the result (for past-expense lookups).
 */
export function useSplitGroupMembers(
  groupId: string | undefined,
  includeInactive = false,
): SplitGroupMember[] | undefined {
  return useLiveQuery(
    async () => {
      if (!groupId) return undefined;
      const all = await getDB().splitGroupMembers.where('groupId').equals(groupId).toArray();
      return all
        .filter((m) => !m.deletedAt)
        .filter((m) => (includeInactive ? true : m.active))
        .sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : 1));
    },
    [groupId, includeInactive],
  );
}

/** Non-deleted expenses for a group, newest first. */
export function useSplitGroupExpenses(groupId: string | undefined): SplitExpense[] | undefined {
  return useLiveQuery(
    async () => {
      if (!groupId) return undefined;
      const all = await getDB().splitExpenses.where('groupId').equals(groupId).toArray();
      return all
        .filter((e) => !e.deletedAt)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
    },
    [groupId],
  );
}

/** Non-deleted settlements for a group, newest first. */
export function useSplitGroupSettlements(groupId: string | undefined): SplitSettlement[] | undefined {
  return useLiveQuery(
    async () => {
      if (!groupId) return undefined;
      const all = await getDB().splitSettlements.where('groupId').equals(groupId).toArray();
      return all
        .filter((s) => !s.deletedAt)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
    },
    [groupId],
  );
}

interface SplitExpenseRelations {
  payers: SplitPayer[];
  shares: SplitShare[];
}

/** Load payer/share rows only for the supplied expenses using their indexed expenseId. */
function useSplitExpenseRelations(
  expenses: SplitExpense[] | undefined,
): SplitExpenseRelations | undefined {
  return useLiveQuery(
    async () => {
      if (!expenses) return undefined;
      const expenseIds = expenses.map((expense) => expense.id);
      if (expenseIds.length === 0) return { payers: [], shares: [] };

      const db = getDB();
      const [payers, shares] = await Promise.all([
        db.splitPayers.where('expenseId').anyOf(expenseIds).toArray(),
        db.splitShares.where('expenseId').anyOf(expenseIds).toArray(),
      ]);
      return { payers, shares };
    },
    [expenses],
  );
}

// ---------------------------------------------------------------------------
// Composite hooks
// ---------------------------------------------------------------------------

export interface GroupBalancesResult {
  balances: Map<string, number>;
  transfers: Transfer[];
}

/**
 * Balances + simplified debts for a group. Returns
 * `undefined` while data is loading; an empty map and
 * transfers once loading is done.
 */
export function useSplitGroupBalances(groupId: string | undefined): GroupBalancesResult | undefined {
  const group = useLiveQuery(
    async () => (groupId ? getDB().splitGroups.get(groupId) : undefined),
    [groupId],
  );
  const members = useSplitGroupMembers(groupId, true);
  const expenses = useSplitGroupExpenses(groupId);
  const relations = useSplitExpenseRelations(expenses);
  const settlements = useSplitGroupSettlements(groupId);

  return useMemo(() => {
    if (!groupId || !group || !members || !expenses || !relations || !settlements) {
      return undefined;
    }
    const balances = computeGroupBalances({
      group,
      members,
      expenses,
      payers: relations.payers,
      shares: relations.shares,
      settlements,
    });
    return { balances, transfers: simplifyDebts(balances) };
  }, [groupId, group, members, expenses, relations, settlements]);
}

/** Group summary used by the landing screen. */
export function useSplitGroupSummary(groupId: string | undefined): GroupSummary | undefined {
  const self = useSelf();
  const group = useLiveQuery(
    async () => (groupId ? getDB().splitGroups.get(groupId) : undefined),
    [groupId],
  );
  const members = useSplitGroupMembers(groupId, true);
  const expenses = useSplitGroupExpenses(groupId);
  const relations = useSplitExpenseRelations(expenses);
  const settlements = useSplitGroupSettlements(groupId);

  return useMemo(() => {
    if (!groupId || !self || !group || !members || !expenses || !relations || !settlements) {
      return undefined;
    }
    return buildGroupSummary(
      {
        group,
        members,
        expenses,
        payers: relations.payers,
        shares: relations.shares,
        settlements,
        selfPersonId: self.id,
      },
      { selfPersonId: self.id },
    );
  }, [groupId, self, group, members, expenses, relations, settlements]);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface SplitDashboardItem {
  group: SplitGroup;
  yourNet: number;
  expenseCount: number;
}

/**
 * Per-group summary for the Split dashboard. For each
 * active group, computes the current user's net position.
 *
 * Lazy implementation: uses the same balance engine as
 * `useSplitGroupSummary` but batches across every group so
 * a single `useLiveQuery` can re-render the dashboard
 * whenever any input row changes.
 */
export function useSplitDashboard(): SplitDashboardItem[] | undefined {
  const self = useSelf();
  return useLiveQuery(async () => {
    if (!self) return undefined;
    const db = getDB();

    // Resolve the self id outside the loop.
    const people = await db.people.toArray();
    const selfRow = findSelf(people);
    if (!selfRow) return [];

    const groups = (await db.splitGroups.toArray()).filter(
      (g) => !g.deletedAt && !g.archived,
    );

    if (groups.length === 0) return [];

    const members = await db.splitGroupMembers.toArray();
    const expenses = await db.splitExpenses.toArray();
    const payers = await db.splitPayers.toArray();
    const shares = await db.splitShares.toArray();
    const settlements = await db.splitSettlements.toArray();

    const out: SplitDashboardItem[] = [];
    for (const g of groups) {
      const groupMembers = members.filter((m) => m.groupId === g.id && !m.deletedAt);
      const groupExpenses = expenses.filter((e) => e.groupId === g.id && !e.deletedAt);
      const expenseIds = new Set(groupExpenses.map((e) => e.id));
      const groupPayers = payers.filter((p) => expenseIds.has(p.expenseId));
      const groupShares = shares.filter((s) => expenseIds.has(s.expenseId));
      const groupSettlements = settlements.filter((s) => s.groupId === g.id && !s.deletedAt);

      const balances = computeGroupBalances({
        group: g,
        members: groupMembers,
        expenses: groupExpenses,
        payers: groupPayers,
        shares: groupShares,
        settlements: groupSettlements,
      });
      out.push({
        group: g,
        yourNet: balances.get(selfRow.id) ?? 0,
        expenseCount: groupExpenses.length,
      });
    }
    out.sort((a, b) => Math.abs(b.yourNet) - Math.abs(a.yourNet));
    return out;
  }, [self]);
}

// ---------------------------------------------------------------------------
// Low-level helpers exposed for the Add page (to pre-load participants)
// ---------------------------------------------------------------------------

/**
 * Fetch every row in the Split tables for a group, including
 * soft-deleted ones. Used by the test suite to verify atomic
 * writes without depending on the live query layer.
 */
export function useSplitGroupRaw(groupId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!groupId) return undefined;
      const db = getDB();
      const [group, members, expenses, settlements] = await Promise.all([
        db.splitGroups.get(groupId),
        db.splitGroupMembers.where('groupId').equals(groupId).toArray(),
        db.splitExpenses.where('groupId').equals(groupId).toArray(),
        db.splitSettlements.where('groupId').equals(groupId).toArray(),
      ]);
      const expenseIds = expenses.map((expense) => expense.id);
      const [payers, shares] = expenseIds.length
        ? await Promise.all([
            db.splitPayers.where('expenseId').anyOf(expenseIds).toArray(),
            db.splitShares.where('expenseId').anyOf(expenseIds).toArray(),
          ])
        : [[], []];

      return { group, members, expenses, payers, shares, settlements };
    },
    [groupId],
  );
}
