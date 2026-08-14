import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Repeat2 } from 'lucide-react';
import { Button, Card, Input, Money, MoneyInput, Spinner, useToast } from '@components/ui';
import { useSplitGroup, useSplitGroupMembers } from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { splitExpenseRepository } from '@modules/split/repositories/splitExpenseRepository';
import { splitGroupRepository } from '@modules/split/repositories/splitGroupRepository';
import { SplitDetailsSheet } from '@modules/split/components/SplitDetailsSheet';
import {
  ExpenseDetailsSheet,
  type SplitRepeatValue,
} from '@modules/split/components/ExpenseDetailsSheet';
import { getSplitCategoryMeta } from '@modules/split/domain/categories';
import {
  allocationSnapshotToInput,
  defaultSplitFromDraft,
  itemizedAllocation,
  nextRecurringDate,
  resolveTripDefaultSplit,
  snapshotForMethod,
} from '@modules/split/domain/entry';
import { todayDateOnly, formatHumanDate } from '@shared/dates';
import { currencyDecimals, decimalToMinor, minorToDecimal } from '@shared/money';
import { prefixedId } from '@shared/ids';
import type {
  SplitAllocationSnapshot,
  SplitExpenseCategory,
  SplitItem,
  SplitMethod,
  SplitRecurringTemplate,
} from '@db/schema';

export function SplitGroupAddPage() {
  const { groupId } = useParams({ from: '/split/group/$groupId/add' });
  const group = useSplitGroup(groupId);

  if (!group) return <div className="flex justify-center py-10"><Spinner /></div>;

  if (group.deletedAt || group.archived) {
    return (
      <Card>
        <h1 className="text-base font-semibold">Cannot add to {group.name}</h1>
        <p className="mt-2 text-sm text-slate-500">This trip is no longer accepting new expenses.</p>
      </Card>
    );
  }

  return <ExpenseForm groupId={groupId} />;
}

function ExpenseForm({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  const group = useSplitGroup(groupId);
  const people = usePeople();
  const self = useSelf();
  const members = useSplitGroupMembers(groupId, true);
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [amountMinor, setAmountMinor] = useState(0);
  const [date, setDate] = useState(todayDateOnly());
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<SplitExpenseCategory>('food');
  const [method, setMethod] = useState<SplitMethod>('equal');
  const [payerId, setPayerId] = useState<string>();
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [allocation, setAllocation] = useState<Record<string, string>>({});
  const [rememberDefault, setRememberDefault] = useState(false);
  const [repeat, setRepeat] = useState<SplitRepeatValue>('never');
  const [foreignEnabled, setForeignEnabled] = useState(false);
  const [originalCurrency, setOriginalCurrency] = useState('USD');
  const [originalAmountMinor, setOriginalAmountMinor] = useState(0);
  const [exchangeRate, setExchangeRate] = useState('');
  const [itemized, setItemized] = useState(false);
  const [items, setItems] = useState<SplitItem[]>([]);
  const [splitSheetOpen, setSplitSheetOpen] = useState(false);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const activeIds = useMemo(
    () => new Set((members ?? []).filter((member) => member.active).map((member) => member.personId)),
    [members],
  );
  const tripPeople = useMemo(
    () => (people ?? []).filter((person) => activeIds.has(person.id)),
    [people, activeIds],
  );

  useEffect(() => {
    if (!group || !self || tripPeople.length === 0 || initialized) return;
    const resolved = resolveTripDefaultSplit({
      saved: group.defaultSplit,
      activePersonIds: tripPeople.map((person) => person.id),
      preferredPayerId: self.id,
    });
    setPayerId(resolved.payerPersonId);
    setParticipantIds(resolved.participantIds);
    setMethod(resolved.splitMethod);
    setAllocation(rawAllocationFromSnapshot(resolved.splitMethod, resolved.allocation, group.currency));
    setOriginalCurrency(group.currency === 'USD' ? 'EUR' : 'USD');
    setInitialized(true);
  }, [group, initialized, self, tripPeople]);

  useEffect(() => {
    if (!group || !foreignEnabled || originalAmountMinor <= 0) return;
    const rate = Number(exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) return;
    const originalScale = 10 ** currencyDecimals(originalCurrency);
    const baseScale = 10 ** currencyDecimals(group.currency);
    const converted = Math.round((originalAmountMinor / originalScale) * rate * baseScale);
    setAmountMinor(converted);
  }, [exchangeRate, foreignEnabled, group, originalAmountMinor, originalCurrency]);

  if (!group || !people || !self || members === undefined) {
    return <div className="flex justify-center py-10"><Spinner /></div>;
  }

  const payer = tripPeople.find((person) => person.id === payerId);
  const categoryMeta = getSplitCategoryMeta(category);
  const splitLabel = itemized
    ? 'Itemized'
    : method === 'equal'
      ? 'Equal'
      : method === 'exact'
        ? 'Exact'
        : method === 'percentage'
          ? 'Percent'
          : 'Shares';
  const detailBits = [categoryMeta.label, formatHumanDate(date)];
  if (repeat !== 'never') detailBits.push(repeat[0]!.toUpperCase() + repeat.slice(1));

  const closeToTrip = () => navigate({ to: '/split/group/$groupId', params: { groupId } });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);

    const cleanTitle = title.trim();
    if (!cleanTitle) return setError('What was this expense for?');
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) return setError('Enter an amount greater than zero.');
    if (!payerId || !activeIds.has(payerId)) return setError('Choose who paid.');

    let effectiveParticipantIds = participantIds;
    let effectiveMethod = method;
    let effectiveAllocation;

    try {
      if (itemized) {
        if (items.length === 0) throw new Error('Add at least one item or remove itemization.');
        if (items.some((item) => !item.title.trim())) throw new Error('Give every item a name.');
        const result = itemizedAllocation(items);
        if (result.totalAmountMinor !== amountMinor) {
          throw new Error('Item amounts must add up to the expense total.');
        }
        effectiveParticipantIds = result.participantIds;
        effectiveMethod = 'exact';
        effectiveAllocation = { method: 'exact' as const, amountsByPersonId: result.amountsByPersonId };
      } else {
        if (participantIds.length === 0) throw new Error('Choose at least one person to split with.');
        const snapshot = snapshotFromRaw(method, participantIds, allocation, group.currency);
        effectiveAllocation = allocationSnapshotToInput(method, participantIds, snapshot);
      }

      if (foreignEnabled) {
        if (originalCurrency === group.currency) throw new Error('Choose a different paid currency or turn off foreign currency.');
        if (originalAmountMinor <= 0) throw new Error('Enter the amount that was paid in the original currency.');
        const rate = Number(exchangeRate);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error('Enter a valid manual exchange rate.');
        if (repeat !== 'never') throw new Error('Recurring foreign-currency expenses are not supported without a future rate source.');
      }
    } catch (err) {
      return setError(err instanceof Error ? err.message : 'Check the split details.');
    }

    setSubmitting(true);
    try {
      await splitExpenseRepository.createAtomic({
        groupId,
        title: cleanTitle,
        amountMinor,
        currency: group.currency,
        date,
        splitMethod: effectiveMethod,
        category,
        note: note.trim() || undefined,
        payers: [{ personId: payerId, amountMinor }],
        participantIds: effectiveParticipantIds,
        allocation: effectiveAllocation,
        originalCurrency: foreignEnabled ? originalCurrency : undefined,
        originalAmountMinor: foreignEnabled ? originalAmountMinor : undefined,
        exchangeRate: foreignEnabled ? Number(exchangeRate) : undefined,
        items: itemized ? items.map((item) => ({ ...item, title: item.title.trim() })) : undefined,
      });

      try {
        if (rememberDefault && !itemized && method !== 'exact') {
          const snapshot = snapshotFromRaw(method, participantIds, allocation, group.currency);
          const saved = defaultSplitFromDraft({
            payerPersonId: payerId,
            participantIds,
            splitMethod: method,
            allocation: snapshot,
          });
          if (saved) await splitGroupRepository.setDefaultSplit(groupId, saved);
        }

        if (repeat !== 'never') {
          const template = buildRecurringTemplate({
            title: cleanTitle,
            amountMinor,
            category,
            payerPersonId: payerId,
            participantIds: effectiveParticipantIds,
            splitMethod: effectiveMethod,
            allocation: itemized
              ? { exactAmountsByPersonId: (effectiveAllocation as { method: 'exact'; amountsByPersonId: Record<string, number> }).amountsByPersonId }
              : snapshotFromRaw(method, participantIds, allocation, group.currency),
            note: note.trim() || undefined,
            frequency: repeat,
            date,
            items: itemized ? items.map((item) => ({ ...item, title: item.title.trim() })) : undefined,
          });
          await splitGroupRepository.setRecurringTemplates(groupId, [
            ...(group.recurringTemplates ?? []),
            template,
          ]);
        }
      } catch (preferenceError) {
        toast.show(
          `Expense saved, but a trip preference could not be updated: ${preferenceError instanceof Error ? preferenceError.message : 'unknown error'}`,
          { variant: 'error' },
        );
        closeToTrip();
        return;
      }

      toast.show(repeat === 'never' ? 'Expense added' : 'Expense added and recurrence saved', { variant: 'success' });
      closeToTrip();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="mx-auto max-w-xl space-y-5 pb-24" onSubmit={save}>
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={closeToTrip}
          className="grid h-11 w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Back to trip"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">New expense</h1>
          <p className="truncate text-xs text-slate-500">{group.name}</p>
        </div>
      </header>

      {tripPeople.length === 0 ? (
        <Card><p className="text-sm font-medium">Add people before adding an expense.</p></Card>
      ) : (
        <>
          <Card className="space-y-4">
            <Input
              label="What was it?"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Dinner, hotel, taxi…"
              autoFocus
              required
              maxLength={200}
            />
            <MoneyInput
              label={foreignEnabled ? `Trip amount · ${group.currency}` : 'Amount'}
              currency={group.currency}
              value={amountMinor}
              onChange={setAmountMinor}
              hint={foreignEnabled ? `Calculated from ${originalCurrency} using your manual rate.` : undefined}
            />
          </Card>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSplitSheetOpen(true)}
              className="surface-interactive flex min-h-16 w-full min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {payer?.isSelf ? 'You' : payer?.name ?? 'Choose payer'} paid · {splitLabel} · {itemized ? `${items.length} item${items.length === 1 ? '' : 's'}` : `${participantIds.length} people`}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Tap only if this expense is different from the trip default.</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => setDetailsSheetOpen(true)}
              className="surface-interactive flex min-h-16 w-full min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{detailBits.join(' · ')}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {foreignEnabled
                    ? `${originalCurrency} ${minorToDecimal(originalAmountMinor, originalCurrency)} → ${group.currency}`
                    : itemized
                      ? `${items.length} item${items.length === 1 ? '' : 's'} itemized`
                      : 'Category, date, repeat, currency, itemization and note'}
                </p>
              </div>
              {repeat !== 'never' ? <Repeat2 size={17} className="shrink-0 text-brand-500" /> : <ChevronRight size={18} className="shrink-0 text-slate-400" />}
            </button>
          </div>

          {foreignEnabled && (
            <Card className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">Original payment</p>
                <p className="truncate text-sm font-semibold">
                  <Money value={{ amountMinor: originalAmountMinor, currency: originalCurrency }} />
                </p>
              </div>
              <p className="text-right text-xs text-slate-500">1 {originalCurrency} = {exchangeRate || '—'} {group.currency}</p>
            </Card>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>
          )}

          <Button type="submit" block size="lg" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save expense'}
          </Button>
        </>
      )}

      <SplitDetailsSheet
        open={splitSheetOpen}
        onClose={() => setSplitSheetOpen(false)}
        people={tripPeople}
        currency={group.currency}
        amountMinor={amountMinor}
        payerId={payerId}
        onPayerChange={setPayerId}
        participantIds={participantIds}
        onParticipantsChange={setParticipantIds}
        method={method}
        onMethodChange={setMethod}
        allocation={allocation}
        onAllocationChange={setAllocation}
        itemized={itemized}
        rememberDefault={rememberDefault}
        onRememberDefaultChange={setRememberDefault}
      />

      <ExpenseDetailsSheet
        open={detailsSheetOpen}
        onClose={() => setDetailsSheetOpen(false)}
        currency={group.currency}
        amountMinor={amountMinor}
        category={category}
        onCategoryChange={setCategory}
        date={date}
        onDateChange={setDate}
        note={note}
        onNoteChange={setNote}
        repeat={repeat}
        onRepeatChange={setRepeat}
        foreignEnabled={foreignEnabled}
        onForeignEnabledChange={setForeignEnabled}
        originalCurrency={originalCurrency}
        onOriginalCurrencyChange={setOriginalCurrency}
        originalAmountMinor={originalAmountMinor}
        onOriginalAmountChange={setOriginalAmountMinor}
        exchangeRate={exchangeRate}
        onExchangeRateChange={setExchangeRate}
        people={tripPeople}
        defaultParticipantIds={participantIds}
        itemized={itemized}
        onItemizedChange={(enabled) => {
          setItemized(enabled);
          if (enabled) setRememberDefault(false);
        }}
        items={items}
        onItemsChange={setItems}
      />
    </form>
  );
}

function rawAllocationFromSnapshot(
  method: SplitMethod,
  snapshot: SplitAllocationSnapshot,
  currency: string,
): Record<string, string> {
  if (method === 'equal') return {};
  if (method === 'exact') {
    return Object.fromEntries(
      Object.entries(snapshot.exactAmountsByPersonId ?? {}).map(([id, amount]) => [id, String(minorToDecimal(amount, currency))]),
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

function snapshotFromRaw(
  method: SplitMethod,
  participantIds: string[],
  allocation: Record<string, string>,
  currency: string,
): SplitAllocationSnapshot {
  if (method === 'equal') return {};
  if (method === 'exact') {
    const exactAmountsByPersonId: Record<string, number> = {};
    for (const id of participantIds) {
      const raw = allocation[id] ?? '';
      if (!raw.trim()) throw new Error('Enter an exact amount for everyone selected.');
      exactAmountsByPersonId[id] = decimalToMinor(raw, currency);
    }
    return { exactAmountsByPersonId };
  }
  if (method === 'percentage') {
    const percentagesByPersonId: Record<string, number> = {};
    for (const id of participantIds) {
      const value = Number(allocation[id] ?? '');
      if (!Number.isFinite(value) || value < 0) throw new Error('Enter a valid percentage for everyone selected.');
      percentagesByPersonId[id] = value;
    }
    return { percentagesByPersonId };
  }
  const sharesByPersonId: Record<string, number> = {};
  for (const id of participantIds) {
    const value = Number(allocation[id] ?? '');
    if (!Number.isInteger(value) || value <= 0) throw new Error('Shares must be positive whole numbers.');
    sharesByPersonId[id] = value;
  }
  return { sharesByPersonId };
}

function buildRecurringTemplate(input: {
  title: string;
  amountMinor: number;
  category: SplitExpenseCategory;
  payerPersonId: string;
  participantIds: string[];
  splitMethod: SplitMethod;
  allocation: SplitAllocationSnapshot;
  note?: string;
  frequency: Exclude<SplitRepeatValue, 'never'>;
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
    nextDate: nextRecurringDate(input.date, input.frequency),
    enabled: true,
    items: input.items,
  };
}
