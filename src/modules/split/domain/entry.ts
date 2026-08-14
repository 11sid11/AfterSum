import type {
  SplitAllocationSnapshot,
  SplitDefaultSplit,
  SplitItem,
  SplitMethod,
  SplitRecurringFrequency,
} from '@db/schema';
import type { SplitAllocationInput } from './validation';
import { computeEqualShares } from './splits';

export interface ResolvedSplitDraft {
  payerPersonId: string;
  participantIds: string[];
  splitMethod: SplitMethod;
  allocation: SplitAllocationSnapshot;
}

export function resolveTripDefaultSplit(input: {
  saved?: SplitDefaultSplit;
  activePersonIds: string[];
  preferredPayerId?: string;
}): ResolvedSplitDraft {
  const active = new Set(input.activePersonIds);
  const fallbackPayer =
    (input.preferredPayerId && active.has(input.preferredPayerId) && input.preferredPayerId) ||
    input.activePersonIds[0] ||
    '';
  const fallback: ResolvedSplitDraft = {
    payerPersonId: fallbackPayer,
    participantIds: [...input.activePersonIds],
    splitMethod: 'equal',
    allocation: {},
  };

  const saved = input.saved;
  if (!saved || saved.participantIds.length === 0) return fallback;
  if (saved.participantIds.some((id) => !active.has(id))) return fallback;

  const payer = saved.payerPersonId && active.has(saved.payerPersonId) ? saved.payerPersonId : fallbackPayer;
  if (!payer) return fallback;

  if (saved.splitMethod === 'percentage') {
    const values = saved.allocation?.percentagesByPersonId;
    if (!values || saved.participantIds.some((id) => !Number.isFinite(values[id]))) return fallback;
    const total = saved.participantIds.reduce((sum, id) => sum + (values[id] ?? 0), 0);
    if (Math.abs(total - 100) > 0.0001) return fallback;
  }

  if (saved.splitMethod === 'shares') {
    const values = saved.allocation?.sharesByPersonId;
    if (!values || saved.participantIds.some((id) => !Number.isInteger(values[id]) || (values[id] ?? 0) <= 0)) {
      return fallback;
    }
  }

  return {
    payerPersonId: payer,
    participantIds: [...saved.participantIds],
    splitMethod: saved.splitMethod,
    allocation: saved.allocation ?? {},
  };
}

export function defaultSplitFromDraft(draft: ResolvedSplitDraft): SplitDefaultSplit | undefined {
  if (draft.participantIds.length === 0 || draft.splitMethod === 'exact') return undefined;
  return {
    payerPersonId: draft.payerPersonId,
    participantIds: [...draft.participantIds],
    splitMethod: draft.splitMethod,
    allocation: snapshotForMethod(draft.splitMethod, draft.allocation),
  };
}

export function snapshotForMethod(
  method: SplitMethod,
  allocation: SplitAllocationSnapshot,
): SplitAllocationSnapshot | undefined {
  if (method === 'equal') return undefined;
  if (method === 'exact') {
    return allocation.exactAmountsByPersonId
      ? { exactAmountsByPersonId: { ...allocation.exactAmountsByPersonId } }
      : undefined;
  }
  if (method === 'percentage') {
    return allocation.percentagesByPersonId
      ? { percentagesByPersonId: { ...allocation.percentagesByPersonId } }
      : undefined;
  }
  return allocation.sharesByPersonId
    ? { sharesByPersonId: { ...allocation.sharesByPersonId } }
    : undefined;
}

export function allocationSnapshotToInput(
  method: SplitMethod,
  participantIds: string[],
  allocation: SplitAllocationSnapshot,
): SplitAllocationInput {
  if (method === 'equal') return { method: 'equal' };
  if (method === 'exact') {
    const values = allocation.exactAmountsByPersonId ?? {};
    return {
      method: 'exact',
      amountsByPersonId: Object.fromEntries(participantIds.map((id) => [id, values[id] ?? 0])),
    };
  }
  if (method === 'percentage') {
    const values = allocation.percentagesByPersonId ?? {};
    return {
      method: 'percentage',
      percentagesByPersonId: Object.fromEntries(participantIds.map((id) => [id, values[id] ?? 0])),
    };
  }
  const values = allocation.sharesByPersonId ?? {};
  return {
    method: 'shares',
    sharesByPersonId: Object.fromEntries(participantIds.map((id) => [id, values[id] ?? 1])),
  };
}

export function itemizedAllocation(items: SplitItem[]): {
  participantIds: string[];
  amountsByPersonId: Record<string, number>;
  totalAmountMinor: number;
} {
  const totals = new Map<string, number>();
  let totalAmountMinor = 0;

  for (const item of items) {
    if (item.amountMinor <= 0) throw new Error('Every item needs an amount greater than zero.');
    if (item.participantIds.length === 0) throw new Error('Choose at least one person for every item.');
    totalAmountMinor += item.amountMinor;
    const amounts = computeEqualShares(item.amountMinor, item.participantIds);
    item.participantIds.forEach((personId, index) => {
      totals.set(personId, (totals.get(personId) ?? 0) + (amounts[index] ?? 0));
    });
  }

  return {
    participantIds: [...totals.keys()],
    amountsByPersonId: Object.fromEntries(totals),
    totalAmountMinor,
  };
}

export function nextRecurringDate(dateOnly: string, frequency: SplitRecurringFrequency): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  else if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
  else date.setFullYear(date.getFullYear() + 1);
  return localDateOnly(date);
}

export function localDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
