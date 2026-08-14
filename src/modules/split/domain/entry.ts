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

export function isTripDefaultSplitValid(
  saved: SplitDefaultSplit | undefined,
  activePersonIds: string[],
): boolean {
  if (!saved || saved.participantIds.length === 0) return false;
  const active = new Set(activePersonIds);
  if (saved.participantIds.some((id) => !active.has(id))) return false;
  if (saved.payerPersonId && !active.has(saved.payerPersonId)) return false;

  if (saved.splitMethod === 'percentage') {
    const values = saved.allocation?.percentagesByPersonId;
    if (!values || saved.participantIds.some((id) => !Number.isFinite(values[id]))) return false;
    const total = saved.participantIds.reduce((sum, id) => sum + (values[id] ?? 0), 0);
    return Math.abs(total - 100) <= 0.0001;
  }

  if (saved.splitMethod === 'shares') {
    const values = saved.allocation?.sharesByPersonId;
    return Boolean(
      values &&
        saved.participantIds.every(
          (id) => Number.isInteger(values[id]) && (values[id] ?? 0) > 0,
        ),
    );
  }

  return saved.splitMethod === 'equal';
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
  if (!isTripDefaultSplitValid(saved, input.activePersonIds) || !saved) return fallback;

  const payer = saved.payerPersonId ?? fallbackPayer;
  if (!payer) return fallback;

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

/**
 * Advance a date-only recurrence without JavaScript's end-of-month overflow.
 * `anchorDate` preserves the original day-of-month/year intent after a clamp.
 */
export function nextRecurringDate(
  dateOnly: string,
  frequency: SplitRecurringFrequency,
  anchorDate: string = dateOnly,
): string {
  const [year, month, day] = parseDateOnly(dateOnly);
  const [anchorYear, anchorMonth, anchorDay] = parseDateOnly(anchorDate);
  void anchorYear;

  if (frequency === 'weekly') {
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 7);
    return localDateOnly(date);
  }

  if (frequency === 'monthly') {
    const targetYear = month === 12 ? year + 1 : year;
    const targetMonth = month === 12 ? 1 : month + 1;
    const clampedDay = Math.min(anchorDay, daysInMonth(targetYear, targetMonth));
    return formatDateOnly(targetYear, targetMonth, clampedDay);
  }

  const targetYear = year + 1;
  const clampedDay = Math.min(anchorDay, daysInMonth(targetYear, anchorMonth));
  return formatDateOnly(targetYear, anchorMonth, clampedDay);
}

export function localDateOnly(date: Date): string {
  return formatDateOnly(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function parseDateOnly(value: string): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day || month < 1 || month > 12 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid recurring date: ${value}`);
  }
  return [year, month, day];
}

function formatDateOnly(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
