import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DateInput,
  Input,
  MoneyInput,
  Spinner,
  Textarea,
  useToast,
} from '@components/ui';
import { useSplitGroup, useSplitGroupMembers } from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { splitExpenseRepository } from '@modules/split/repositories/splitExpenseRepository';
import { SplitMethodSelector } from '@modules/split/components/SplitMethodSelector';
import { SplitAllocationEditor } from '@modules/split/components/SplitAllocationEditor';
import { SPLIT_CATEGORIES } from '@modules/split/domain/categories';
import { todayDateOnly } from '@shared/dates';
import { decimalToMinor } from '@shared/money';
import type { Person, SplitExpenseCategory, SplitMethod } from '@db/schema';
import { ArrowLeft, Check } from 'lucide-react';

export function SplitGroupAddPage() {
  const params = useParams({ from: '/split/group/$groupId/add' });
  const groupId = params.groupId;
  const navigate = useNavigate();
  const group = useSplitGroup(groupId);

  if (!group) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

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

interface ExpenseFormProps {
  groupId: string;
  groupName: string;
  currency: string;
}

function ExpenseForm({ groupId, groupName, currency }: ExpenseFormProps) {
  const navigate = useNavigate();
  const people = usePeople();
  const self = useSelf();
  const groupMembers = useSplitGroupMembers(groupId, true);
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
  const [participantsInitialized, setParticipantsInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const activeMemberIds = useMemo(
    () => new Set((groupMembers ?? []).filter((member) => member.active).map((member) => member.personId)),
    [groupMembers],
  );
  const participantPeople = useMemo(
    () => (people ?? []).filter((person) => activeMemberIds.has(person.id)),
    [people, activeMemberIds],
  );
  const activeKey = participantPeople.map((person) => person.id).join('|');

  useEffect(() => {
    if (participantPeople.length === 0) return;

    if (!participantsInitialized) {
      setParticipantIds(participantPeople.map((person) => person.id));
      setParticipantsInitialized(true);
    }

    if (!payerId || !activeMemberIds.has(payerId)) {
      const defaultPayer =
        self && activeMemberIds.has(self.id) ? self.id : participantPeople[0]?.id;
      setPayerId(defaultPayer);
    }
  }, [activeKey, activeMemberIds, participantPeople, participantsInitialized, payerId, self]);

  if (!people || !self || groupMembers === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const selectedPeople = participantPeople.filter((person) => participantIds.includes(person.id));

  const toggleParticipant = (personId: string) => {
    setParticipantIds((current) => {
      const selected = current.includes(personId);
      if (selected && current.length === 1) return current;
      const next = selected ? current.filter((id) => id !== personId) : [...current, personId];
      setAllocation((values) => {
        const cleaned: Record<string, string> = {};
        for (const id of next) cleaned[id] = values[id] ?? '';
        return cleaned;
      });
      return next;
    });
  };

  const selectEveryone = () => {
    const ids = participantPeople.map((person) => person.id);
    setParticipantIds(ids);
    setAllocation((values) => {
      const next: Record<string, string> = {};
      for (const id of ids) next[id] = values[id] ?? '';
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);

    if (!title.trim()) {
      setError('What was this expense for?');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!payerId || !activeMemberIds.has(payerId)) {
      setError('Choose who paid.');
      return;
    }
    if (participantIds.length === 0) {
      setError('Choose at least one person to split with.');
      return;
    }

    setSubmitting(true);
    try {
      const allocationInput = buildAllocationInput(method, participantIds, allocation, currency);
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
        allocation: allocationInput,
      });

      // Category is descriptive metadata. It is intentionally kept separate
      // from the financial allocation transaction so old Split records remain compatible.
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
    <form className="mx-auto max-w-xl space-y-5 pb-24" onSubmit={handleSubmit}>
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Back to trip"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-semibold">New expense</h1>
          <p className="text-xs text-slate-500">{groupName}</p>
        </div>
      </header>

      {participantPeople.length === 0 ? (
        <Card>
          <p className="text-sm font-medium">Add people before adding an expense.</p>
          <p className="mt-1 text-sm text-slate-500">
            A trip needs at least one active participant.
          </p>
        </Card>
      ) : (
        <>
          <section className="space-y-3">
            <Input
              label="What was it?"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Dinner, Hotel, Taxi…"
              autoFocus
              required
            />
            <MoneyInput label="Amount" currency={currency} value={amount} onChange={setAmount} />
          </section>

          <section className="space-y-2">
            <SectionLabel>Paid by</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {participantPeople.map((person) => (
                <ChoiceChip
                  key={person.id}
                  label={person.isSelf ? 'You' : person.name}
                  selected={payerId === person.id}
                  onClick={() => setPayerId(person.id)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>Split with</SectionLabel>
              <button
                type="button"
                onClick={selectEveryone}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Everyone
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {participantPeople.map((person) => (
                <ChoiceChip
                  key={person.id}
                  label={person.isSelf ? 'You' : person.name}
                  selected={participantIds.includes(person.id)}
                  onClick={() => toggleParticipant(person.id)}
                />
              ))}
            </div>
            <p className="text-xs text-slate-500">
              {participantIds.length} of {participantPeople.length} people selected
            </p>
          </section>

          <section className="space-y-2">
            <SectionLabel>Category</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {SPLIT_CATEGORIES.map((item) => (
                <ChoiceChip
                  key={item.value}
                  label={`${item.icon} ${item.label}`}
                  selected={category === item.value}
                  onClick={() => setCategory(item.value)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <SectionLabel>How should it be split?</SectionLabel>
            <SplitMethodSelector
              value={method}
              onChange={(next) => {
                setMethod(next);
                setAllocation({});
              }}
            />
            <p className="text-xs text-slate-500">
              {method === 'equal'
                ? 'Everyone selected gets an equal share.'
                : method === 'exact'
                  ? 'Enter the exact amount each person should pay.'
                  : method === 'percentage'
                    ? 'Enter each person’s percentage; the total must be 100%.'
                    : 'Give people weights such as 1 share or 2 shares.'}
            </p>
          </section>

          {method !== 'equal' && selectedPeople.length > 0 && (
            <SplitAllocationEditor
              method={method}
              participants={selectedPeople}
              currency={currency}
              totalAmountMinor={amount}
              values={allocation}
              onChange={(personId, raw) =>
                setAllocation((current) => ({ ...current, [personId]: raw }))
              }
              error={
                method === 'exact' && amount > 0
                  ? validateExact(participantIds, allocation, amount, currency)
                  : undefined
              }
            />
          )}

          <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">More details</summary>
            <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-800">
              <DateInput label="Date" value={date} onChange={setDate} />
              <Textarea
                label="Note / receipt reference"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note, bill number or receipt filename"
              />
            </div>
          </details>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}

          <Button type="submit" block size="lg" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save expense'}
          </Button>
        </>
      )}
    </form>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold">{children}</h2>;
}

function ChoiceChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        selected
          ? 'inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white'
          : 'inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
      }
    >
      {selected && <Check size={14} />}
      {label}
    </button>
  );
}

function validateExact(
  participantIds: string[],
  allocation: Record<string, string>,
  amountMinor: number,
  currency: string,
): string | undefined {
  let total = 0;
  for (const id of participantIds) {
    const raw = allocation[id] ?? '';
    if (!raw.trim()) return 'Enter an amount for everyone selected.';
    try {
      total += decimalToMinor(raw, currency);
    } catch {
      return 'One of the amounts is invalid.';
    }
  }
  return total === amountMinor ? undefined : 'Exact amounts must add up to the expense total.';
}

function buildAllocationInput(
  method: SplitMethod,
  participantIds: string[],
  allocation: Record<string, string>,
  currency: string,
) {
  switch (method) {
    case 'equal':
      return { method: 'equal' as const };
    case 'exact': {
      const amountsByPersonId: Record<string, number> = {};
      for (const id of participantIds) {
        const raw = allocation[id] ?? '';
        if (!raw.trim()) throw new Error('Enter an exact amount for everyone selected.');
        amountsByPersonId[id] = decimalToMinor(raw, currency);
      }
      return { method: 'exact' as const, amountsByPersonId };
    }
    case 'percentage': {
      const percentagesByPersonId: Record<string, number> = {};
      for (const id of participantIds) {
        const value = Number(allocation[id] ?? '');
        if (!Number.isFinite(value) || value < 0) throw new Error('Enter a valid percentage for everyone selected.');
        percentagesByPersonId[id] = value;
      }
      return { method: 'percentage' as const, percentagesByPersonId };
    }
    case 'shares': {
      const sharesByPersonId: Record<string, number> = {};
      for (const id of participantIds) {
        const value = Number(allocation[id] ?? '');
        if (!Number.isInteger(value) || value <= 0) throw new Error('Shares must be positive whole numbers.');
        sharesByPersonId[id] = value;
      }
      return { method: 'shares' as const, sharesByPersonId };
    }
  }
}

void Person;
