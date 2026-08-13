import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, DateInput, Input, MoneyInput, Spinner, Textarea, useToast } from '@components/ui';
import { useSplitGroup, useSplitGroupMembers } from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { splitExpenseRepository } from '@modules/split/repositories/splitExpenseRepository';
import { SplitMethodSelector } from '@modules/split/components/SplitMethodSelector';
import { SplitAllocationEditor } from '@modules/split/components/SplitAllocationEditor';
import { SPLIT_CATEGORIES } from '@modules/split/domain/categories';
import { todayDateOnly } from '@shared/dates';
import { decimalToMinor } from '@shared/money';
import type { SplitExpenseCategory, SplitMethod } from '@db/schema';
import { ArrowLeft, Check } from 'lucide-react';

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

  return <ExpenseForm groupId={groupId} groupName={group.name} currency={group.currency} />;
}

function ExpenseForm({ groupId, groupName, currency }: { groupId: string; groupName: string; currency: string }) {
  const navigate = useNavigate();
  const people = usePeople();
  const self = useSelf();
  const members = useSplitGroupMembers(groupId, true);
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayDateOnly());
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<SplitExpenseCategory>('food');
  const [method, setMethod] = useState<SplitMethod>('equal');
  const [payerId, setPayerId] = useState<string>();
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [allocation, setAllocation] = useState<Record<string, string>>({});
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
    if (tripPeople.length === 0) return;
    if (!initialized) {
      setParticipantIds(tripPeople.map((person) => person.id));
      setInitialized(true);
    }
    if (!payerId || !activeIds.has(payerId)) {
      setPayerId(self && activeIds.has(self.id) ? self.id : tripPeople[0]?.id);
    }
  }, [activeIds, initialized, payerId, self, tripPeople]);

  if (!people || !self || members === undefined) return <div className="flex justify-center py-10"><Spinner /></div>;

  const selectedPeople = tripPeople.filter((person) => participantIds.includes(person.id));

  const toggleParticipant = (personId: string) => {
    setParticipantIds((current) => {
      const selected = current.includes(personId);
      if (selected && current.length === 1) return current;
      const next = selected ? current.filter((id) => id !== personId) : [...current, personId];
      setAllocation((values) => Object.fromEntries(next.map((id) => [id, values[id] ?? ''])));
      return next;
    });
  };

  const selectEveryone = () => {
    const ids = tripPeople.map((person) => person.id);
    setParticipantIds(ids);
    setAllocation((values) => Object.fromEntries(ids.map((id) => [id, values[id] ?? ''])));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    if (!title.trim()) return setError('What was this expense for?');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter an amount greater than zero.');
    if (!payerId || !activeIds.has(payerId)) return setError('Choose who paid.');
    if (participantIds.length === 0) return setError('Choose at least one person to split with.');

    setSubmitting(true);
    try {
      const { expense } = await splitExpenseRepository.createAtomic({
        groupId,
        title: title.trim(),
        amountMinor: amount,
        currency,
        date,
        splitMethod: method,
        note: note.trim() || undefined,
        payers: [{ personId: payerId, amountMinor: amount }],
        participantIds,
        allocation: buildAllocationInput(method, participantIds, allocation, currency),
      });
      await splitExpenseRepository.update(expense.id, { category });
      toast.show('Expense added', { variant: 'success' });
      navigate({ to: '/split/group/$groupId', params: { groupId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="mx-auto max-w-xl space-y-5 pb-24" onSubmit={save}>
      <header className="flex items-center gap-2">
        <button type="button" onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Back to trip">
          <ArrowLeft size={18} />
        </button>
        <div><h1 className="text-lg font-semibold">New expense</h1><p className="text-xs text-slate-500">{groupName}</p></div>
      </header>

      {tripPeople.length === 0 ? (
        <Card><p className="text-sm font-medium">Add people before adding an expense.</p></Card>
      ) : (
        <>
          <section className="space-y-3">
            <Input label="What was it?" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner, Hotel, Taxi…" autoFocus required />
            <MoneyInput label="Amount" currency={currency} value={amount} onChange={setAmount} />
          </section>

          <ChoiceSection label="Paid by">
            {tripPeople.map((person) => <ChoiceChip key={person.id} label={person.isSelf ? 'You' : person.name} selected={payerId === person.id} onClick={() => setPayerId(person.id)} />)}
          </ChoiceSection>

          <section className="space-y-2">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Split with</h2><button type="button" onClick={selectEveryone} className="text-xs font-medium text-brand-600 hover:underline">Everyone</button></div>
            <div className="flex flex-wrap gap-2">
              {tripPeople.map((person) => <ChoiceChip key={person.id} label={person.isSelf ? 'You' : person.name} selected={participantIds.includes(person.id)} onClick={() => toggleParticipant(person.id)} />)}
            </div>
            <p className="text-xs text-slate-500">{participantIds.length} of {tripPeople.length} people selected</p>
          </section>

          <ChoiceSection label="Category">
            {SPLIT_CATEGORIES.map((item) => <ChoiceChip key={item.value} label={`${item.icon} ${item.label}`} selected={category === item.value} onClick={() => setCategory(item.value)} />)}
          </ChoiceSection>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">How should it be split?</h2>
            <SplitMethodSelector value={method} onChange={(next) => { setMethod(next); setAllocation({}); }} />
            <p className="text-xs text-slate-500">{methodHelp(method)}</p>
          </section>

          {method !== 'equal' && selectedPeople.length > 0 && (
            <SplitAllocationEditor method={method} participants={selectedPeople} currency={currency} totalAmountMinor={amount} values={allocation} onChange={(personId, raw) => setAllocation((current) => ({ ...current, [personId]: raw }))} error={method === 'exact' && amount > 0 ? validateExact(participantIds, allocation, amount, currency) : undefined} />
          )}

          <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">More details</summary>
            <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-800">
              <DateInput label="Date" value={date} onChange={setDate} />
              <Textarea label="Note / receipt reference" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note, bill number or receipt filename" />
            </div>
          </details>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
          <Button type="submit" block size="lg" disabled={submitting}>{submitting ? 'Saving…' : 'Save expense'}</Button>
        </>
      )}
    </form>
  );
}

function ChoiceSection({ label, children }: { label: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h2 className="text-sm font-semibold">{label}</h2><div className="flex flex-wrap gap-2">{children}</div></section>;
}

function ChoiceChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={selected ? 'inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white' : 'inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}>
      {selected && <Check size={14} />}{label}
    </button>
  );
}

function methodHelp(method: SplitMethod): string {
  if (method === 'equal') return 'Everyone selected gets an equal share.';
  if (method === 'exact') return 'Enter the exact amount each person should pay.';
  if (method === 'percentage') return 'Enter each person’s percentage; the total must be 100%.';
  return 'Give people weights such as 1 share or 2 shares.';
}

function validateExact(participantIds: string[], allocation: Record<string, string>, amountMinor: number, currency: string): string | undefined {
  let total = 0;
  for (const id of participantIds) {
    const raw = allocation[id] ?? '';
    if (!raw.trim()) return 'Enter an amount for everyone selected.';
    try { total += decimalToMinor(raw, currency); } catch { return 'One of the amounts is invalid.'; }
  }
  return total === amountMinor ? undefined : 'Exact amounts must add up to the expense total.';
}

function buildAllocationInput(method: SplitMethod, participantIds: string[], allocation: Record<string, string>, currency: string) {
  if (method === 'equal') return { method: 'equal' as const };
  if (method === 'exact') {
    const amountsByPersonId: Record<string, number> = {};
    for (const id of participantIds) {
      const raw = allocation[id] ?? '';
      if (!raw.trim()) throw new Error('Enter an exact amount for everyone selected.');
      amountsByPersonId[id] = decimalToMinor(raw, currency);
    }
    return { method: 'exact' as const, amountsByPersonId };
  }
  if (method === 'percentage') {
    const percentagesByPersonId: Record<string, number> = {};
    for (const id of participantIds) {
      const value = Number(allocation[id] ?? '');
      if (!Number.isFinite(value) || value < 0) throw new Error('Enter a valid percentage for everyone selected.');
      percentagesByPersonId[id] = value;
    }
    return { method: 'percentage' as const, percentagesByPersonId };
  }
  const sharesByPersonId: Record<string, number> = {};
  for (const id of participantIds) {
    const value = Number(allocation[id] ?? '');
    if (!Number.isInteger(value) || value <= 0) throw new Error('Shares must be positive whole numbers.');
    sharesByPersonId[id] = value;
  }
  return { method: 'shares' as const, sharesByPersonId };
}
