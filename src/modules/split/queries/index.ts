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
      const filtered = all
        .filter((m) => !m.deletedAt)
        .filter((m) => (includeInactive ? true : m.active))
        .sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : 1));
      return filtered;
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
  const groups = useLiveQuery(async () => (groupId ? getDB().splitGroups.get(groupId) : undefined), [groupId]);
  const members = useSplitGroupMembers(groupId, true);
  const expenses = useSplitGroupExpenses(groupId);
  const payers = useLiveQuery(
    async () => {
      if (!groupId) return undefined;
      const all = await getDB().splitExpenses.where('groupId').equals(groupId).toArray();
      const ids = new Set(all.map((e) => e.id));
      if (ids.size === 0) return [];
      const list = await getDB().splitPayers.toArray();
      return list.filter((p) => ids.has(p.expenseId));
    },
    [groupId],
  );
  const shares = useLiveQuery(
    async () => {
      if (!groupId) return undefined;
      const all = await getDB().splitExpenses.where('groupId').equals(groupId).toArray();
      const ids = new Set(all.map((e) => e.id));
      if (ids.size === 0) return [];
      const list = await getDB().splitShares.toArray();
      return list.filter((s) => ids.has(s.expenseId));
    },
    [groupId],
  );
  const settlements = useSplitGroupSettlements(groupId);

  return useLiveQuery(() => {
    if (!groupId) return undefined;
    if (!groups || !members || !expenses || !payers || !shares || !settlements) return undefined;
    const balances = computeGroupBalances({
      group: groups,
      members,
      expenses,
      payers,
      shares,
      settlements,
    });
    return { balances, transfers: simplifyDebts(balances) };
  }, [groupId, groups, members, expenses, payers, shares, settlements]);
}

/** Group summary used by the landing screen. */
export function useSplitGroupSummary(groupId: string | undefined): GroupSummary | undefined {
  const self = useSelf();
  const group = useLiveQuery(async () => (groupId ? getDB().splitGroups.get(groupId) : undefined), [groupId]);
  const members = useSplitGroupMembers(groupId, true);
  const expenses = useSplitGroupExpenses(groupId);
  const payers = useLiveQuery(
    async () => {
      if (!groupId) return undefined;
      const all = await getDB().splitExpenses.where('groupId').equals(groupId).toArray();
      const ids = new Set(all.map((e) => e.id));
      if (ids.size === 0) return [];
      const list = await getDB().splitPayers.toArray();
      return list.filter((p) => ids.has(p.expenseId));
    },
    [groupId],
  );
  const shares = useLiveQuery(
    async () => {
      if (!groupId) return undefined;
      const all = await getDB().splitExpenses.where('groupId').equals(groupId).toArray();
      const ids = new Set(all.map((e) => e.id));
      if (ids.size === 0) return [];
      const list = await getDB().splitShares.toArray();
      return list.filter((s) => ids.has(s.expenseId));
    },
    [groupId],
  );
  const settlements = useSplitGroupSettlements(groupId);

  return useLiveQuery(() => {
    if (!groupId || !self) return undefined;
    if (!group || !members || !expenses || !payers || !shares || !settlements) return undefined;
    return buildGroupSummary(
      {
        group,
        members,
        expenses,
        payers,
        shares,
        settlements,
        selfPersonId: self.id,
      },
      { selfPersonId: self.id },
    );
  }, [groupId, self, group, members, expenses, payers, shares, settlements]);
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
      const [g, ms, es, ps, ss, sts] = await Promise.all([
        db.splitGroups.get(groupId),
        db.splitGroupMembers.where('groupId').equals(groupId).toArray(),
        db.splitExpenses.where('groupId').equals(groupId).toArray(),
        (async () => {
          const list = await db.splitExpenses.where('groupId').equals(groupId).toArray();
          const ids = new Set(list.map((e) => e.id));
          if (ids.size === 0) return [] as SplitPayer[];
          const all = await db.splitPayers.toArray();
          return all.filter((p) => ids.has(p.expenseId));
        })(),
        (async () => {
          const list = await db.splitExpenses.where('groupId').equals(groupId).toArray();
          const ids = new Set(list.map((e) => e.id));
          if (ids.size === 0) return [] as SplitShare[];
          const all = await db.splitShares.toArray();
          return all.filter((s) => ids.has(s.expenseId));
        })(),
        db.splitSettlements.where('groupId').equals(groupId).toArray(),
      ]);
      return { group: g, members: ms ?? [], expenses: es ?? [], payers: ps ?? [], shares: ss ?? [], settlements: sts ?? [] };
    },
    [groupId],
  );
}
