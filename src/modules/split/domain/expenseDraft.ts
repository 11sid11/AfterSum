import type {
  SplitAllocationSnapshot,
  SplitExpenseCategory,
  SplitItem,
  SplitMethod,
  SplitRecurringFrequency,
  SplitRecurringTemplate,
} from '@db/schema';
import { decimalToMinor, minorToDecimal } from '@shared/money';
import { prefixedId } from '@shared/ids';
import { nextRecurringDate, snapshotForMethod } from './entry';

export function allocationSnapshotToFormValues(
  method: SplitMethod,
  snapshot: SplitAllocationSnapshot,
  currency: string,
): Record<string, string> {
  if (method === 'equal') return {};
  if (method === 'exact') {
    return Object.fromEntries(
      Object.entries(snapshot.exactAmountsByPersonId ?? {}).map(([id, amount]) => [
        id,
        String(minorToDecimal(amount, currency)),
      ]),
    );
  }
  if (method === 'percentage') {
    return Object.fromEntries(
      Object.entries(snapshot.percentagesByPersonId ?? {}).map(([id, value]) => [id, String(value)]),
    );
  }
  return Object.fromEntries(
    Object.entries(snapshot.sharesByPersonId ?? {}).map(([id, value]) => [id, String(value)]),
  );
}

export function formValuesToAllocationSnapshot(
  method: SplitMethod,
  participantIds: string[],
  values: Record<string, string>,
  currency: string,
): SplitAllocationSnapshot {
  if (method === 'equal') return {};

  if (method === 'exact') {
    const exactAmountsByPersonId: Record<string, number> = {};
    for (const id of participantIds) {
      const raw = values[id] ?? '';
      if (!raw.trim()) throw new Error('Enter an exact amount for everyone selected.');
      exactAmountsByPersonId[id] = decimalToMinor(raw, currency);
    }
    return { exactAmountsByPersonId };
  }

  if (method === 'percentage') {
    const percentagesByPersonId: Record<string, number> = {};
    for (const id of participantIds) {
      const value = Number(values[id] ?? '');
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('Enter a valid percentage for everyone selected.');
      }
      percentagesByPersonId[id] = value;
    }
    return { percentagesByPersonId };
  }

  const sharesByPersonId: Record<string, number> = {};
  for (const id of participantIds) {
    const value = Number(values[id] ?? '');
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('Shares must be positive whole numbers.');
    }
    sharesByPersonId[id] = value;
  }
  return { sharesByPersonId };
}

export function makeRecurringTemplate(input: {
  title: string;
  amountMinor: number;
  category: SplitExpenseCategory;
  payerPersonId: string;
  participantIds: string[];
  splitMethod: SplitMethod;
  allocation: SplitAllocationSnapshot;
  note?: string;
  frequency: SplitRecurringFrequency;
  date: string;
  items?: SplitItem[];
}): SplitRecurringTemplate {
  return {
    id: prefixedId('rec'),
    title: input.title,
    amountMinor: input.amountMinor,
    category: input.category,
    payerPersonId: input.payerPersonId,
    participantIds: [...input.participantIds],
    splitMethod: input.splitMethod,
    allocation: snapshotForMethod(input.splitMethod, input.allocation),
    note: input.note,
    frequency: input.frequency,
    anchorDate: input.date,
    nextDate: nextRecurringDate(input.date, input.frequency, input.date),
    enabled: true,
    items: input.items,
  };
}
