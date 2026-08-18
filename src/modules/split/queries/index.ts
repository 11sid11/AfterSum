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

function pushGrouped<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const rows = map.get(key) ?? [];
  rows.push(value);
  map.set(key, rows);
}

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

/** Per-group summary for the Split dashboard, batched in one live query. */
export function useSplitDashboard(): SplitDashboardItem[] | undefined {
  const self = useSelf();
  return useLiveQuery(async () => {
    if (!self) return undefined;
    const db = getDB();
    const groups = (await db.splitGroups.toArray()).filter(
      (group) => !group.deletedAt && !group.archived,
    );
    if (groups.length === 0) return [];

    const [members, expenses, payers, shares, settlements] = await Promise.all([
      db.splitGroupMembers.toArray(),
      db.splitExpenses.toArray(),
      db.splitPayers.toArray(),
      db.splitShares.toArray(),
      db.splitSettlements.toArray(),
    ]);

    const membersByGroup = new Map<string, SplitGroupMember[]>();
    const expensesByGroup = new Map<string, SplitExpense[]>();
    const payersByGroup = new Map<string, SplitPayer[]>();
    const sharesByGroup = new Map<string, SplitShare[]>();
    const settlementsByGroup = new Map<string, SplitSettlement[]>();
    const groupIdByExpense = new Map<string, string>();

    for (const member of members) {
      if (!member.deletedAt) pushGrouped(membersByGroup, member.groupId, member);
    }
    for (const expense of expenses) {
      if (expense.deletedAt) continue;
      pushGrouped(expensesByGroup, expense.groupId, expense);
      groupIdByExpense.set(expense.id, expense.groupId);
    }
    for (const payer of payers) {
      if (payer.deletedAt) continue;
      const groupId = groupIdByExpense.get(payer.expenseId);
      if (groupId) pushGrouped(payersByGroup, groupId, payer);
    }
    for (const share of shares) {
      if (share.deletedAt) continue;
      const groupId = groupIdByExpense.get(share.expenseId);
      if (groupId) pushGrouped(sharesByGroup, groupId, share);
    }
    for (const settlement of settlements) {
      if (!settlement.deletedAt) pushGrouped(settlementsByGroup, settlement.groupId, settlement);
    }

    const out = groups.map((group) => {
      const groupExpenses = expensesByGroup.get(group.id) ?? [];
      const balances = computeGroupBalances({
        group,
        members: membersByGroup.get(group.id) ?? [],
        expenses: groupExpenses,
        payers: payersByGroup.get(group.id) ?? [],
        shares: sharesByGroup.get(group.id) ?? [],
        settlements: settlementsByGroup.get(group.id) ?? [],
      });
      return {
        group,
        yourNet: balances.get(self.id) ?? 0,
        expenseCount: groupExpenses.length,
      };
    });

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
