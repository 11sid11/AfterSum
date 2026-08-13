import { useNavigate, useParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Money,
  Spinner,
  useToast,
} from '@components/ui';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Plus,
  ReceiptText,
  Search,
  Settings as SettingsIcon,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  useSplitGroup,
  useSplitGroupBalances,
  useSplitGroupRaw,
  useSplitGroupSummary,
} from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { useAppSettings } from '@shared/settings/useSettings';
import { splitExpenseRepository } from '@modules/split/repositories/splitExpenseRepository';
import { splitGroupMemberRepository } from '@modules/split/repositories/splitGroupMemberRepository';
import { splitSettlementRepository } from '@modules/split/repositories/splitSettlementRepository';
import { personRepository } from '@shared/people/repository';
import { BalanceRow } from '@modules/split/components/BalanceRow';
import { getSplitCategoryMeta } from '@modules/split/domain/categories';
import { formatHumanDate, todayDateOnly } from '@shared/dates';
import { UNDO_TIMEOUT_MS } from '@app/constants';
import type { Person, SplitExpense, SplitSettlement } from '@db/schema';

type TripTab = 'expenses' | 'people' | 'balances' | 'search';

const TABS: Array<{ value: TripTab; label: string; icon: typeof ReceiptText }> = [
  { value: 'expenses', label: 'Expenses', icon: ReceiptText },
  { value: 'people', label: 'People', icon: Users },
  { value: 'balances', label: 'Balances', icon: WalletCards },
  { value: 'search', label: 'Search', icon: Search },
];

export function SplitGroupPage() {
  const params = useParams({ from: '/split/group/$groupId' });
  const groupId = params.groupId;
  const navigate = useNavigate();
  const group = useSplitGroup(groupId);
  const summary = useSplitGroupSummary(groupId);
  const raw = useSplitGroupRaw(groupId);
  const balanceResult = useSplitGroupBalances(groupId);
  const people = usePeople();
  const self = useSelf();
  const settings = useAppSettings();
  const toast = useToast();
  const [tab, setTab] = useState<TripTab>('expenses');

  if (!group || !summary || !raw || !balanceResult || !people || !self) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (group.deletedAt || group.archived) {
    return (
      <Card>
        <h1 className="text-base font-semibold">{group.name}</h1>
        <p className="mt-2 text-sm text-slate-500">
          This trip is {group.archived ? 'archived' : 'deleted'}.
        </p>
        <Button className="mt-3" variant="secondary" onClick={() => navigate({ to: '/split' })}>
          Back to Split
        </Button>
      </Card>
    );
  }

  const hide = settings?.hideAmounts ?? false;
  const activeExpenses = raw.expenses
    .filter((expense) => !expense.deletedAt)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1));
  const activeSettlements = raw.settlements
    .filter((settlement) => !settlement.deletedAt)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1));
  const activeMembers = raw.members.filter((member) => !member.deletedAt && member.active);
  const personMap = new Map(people.map((person) => [person.id, person]));

  const expensePayers = new Map<string, string>();
  for (const payer of raw.payers) {
    if (!expensePayers.has(payer.expenseId)) expensePayers.set(payer.expenseId, payer.personId);
  }

  const expenseParticipantNames = new Map<string, string[]>();
  for (const share of raw.shares) {
    const list = expenseParticipantNames.get(share.expenseId) ?? [];
    const person = personMap.get(share.personId);
    if (person) list.push(person.isSelf ? 'You' : person.name);
    expenseParticipantNames.set(share.expenseId, list);
  }

  const handleDeleteExpense = async (expense: SplitExpense) => {
    await splitExpenseRepository.softDelete(expense.id);
    toast.show(`“${expense.title}” deleted`, {
      action: {
        label: 'Undo',
        onClick: () => void splitExpenseRepository.restore(expense.id),
      },
      duration: UNDO_TIMEOUT_MS,
    });
  };

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: '/split' })}
            className="mt-0.5 rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Back to trips"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{group.name}</h1>
            <p className="text-sm text-slate-500">
              {activeMembers.length} participant{activeMembers.length === 1 ? '' : 's'} · {group.currency}
            </p>
            {group.description && <p className="mt-1 text-xs text-slate-400">{group.description}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: '/split/group/$groupId/settings', params: { groupId } })}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Trip settings"
        >
          <SettingsIcon size={18} />
        </button>
      </header>

      <Card>
        <div className="grid grid-cols-3 gap-3">
          <TripStat
            label="Total spent"
            value={<Money value={{ amountMinor: summary.totalSpent, currency: group.currency }} hide={hide} />}
          />
          <TripStat label="Expenses" value={String(activeExpenses.length)} />
          <TripStat label="To settle" value={String(balanceResult.transfers.length)} accent />
        </div>
      </Card>

      <nav className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {TABS.map((item) => {
          const Icon = item.icon;
          const selected = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={
                selected
                  ? 'flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl bg-brand-600 px-1 text-xs font-medium text-white'
                  : 'flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }
              aria-pressed={selected}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {tab === 'expenses' && (
        <ExpensesPanel
          expenses={activeExpenses}
          currency={group.currency}
          hide={hide}
          personMap={personMap}
          expensePayers={expensePayers}
          participantNames={expenseParticipantNames}
          onDelete={handleDeleteExpense}
        />
      )}

      {tab === 'people' && (
        <PeoplePanel
          groupId={groupId}
          people={people}
          self={self}
          members={raw.members}
          expenses={activeExpenses}
          payers={raw.payers}
          shares={raw.shares}
          settlements={activeSettlements}
        />
      )}

      {tab === 'balances' && (
        <BalancesPanel
          groupId={groupId}
          currency={group.currency}
          people={people}
          self={self}
          members={activeMembers}
          balances={balanceResult.balances}
          transfers={balanceResult.transfers}
          settlements={activeSettlements}
          hide={hide}
        />
      )}

      {tab === 'search' && (
        <SearchPanel
          expenses={activeExpenses}
          currency={group.currency}
          hide={hide}
          personMap={personMap}
          expensePayers={expensePayers}
          participantNames={expenseParticipantNames}
        />
      )}

      {tab === 'expenses' && (
        <button
          type="button"
          onClick={() =>
            navigate({ to: '/split/group/$groupId/add', params: { groupId }, search: { type: 'expense' } })
          }
          className="fixed bottom-20 right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-brand-600 px-5 font-semibold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 sm:bottom-6"
          aria-label="Add expense"
        >
          <Plus size={21} />
          Expense
        </button>
      )}
    </div>
  );
}

function TripStat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className={accent ? 'mt-1 truncate text-lg font-semibold text-emerald-600' : 'mt-1 truncate text-lg font-semibold'}>
        {value}
      </div>
    </div>
  );
}

function ExpensesPanel({
  expenses,
  currency,
  hide,
  personMap,
  expensePayers,
  participantNames,
  onDelete,
}: {
  expenses: SplitExpense[];
  currency: string;
  hide: boolean;
  personMap: Map<string, Person>;
  expensePayers: Map<string, string>;
  participantNames: Map<string, string[]>;
  onDelete: (expense: SplitExpense) => Promise<void>;
}) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptText size={32} />}
        title="No expenses yet"
        description="Tap + Expense to split your first trip cost."
      />
    );
  }

  return (
    <section className="space-y-2">
      {expenses.map((expense) => (
        <TripExpenseCard
          key={expense.id}
          expense={expense}
          currency={currency}
          hide={hide}
          payer={personMap.get(expensePayers.get(expense.id) ?? '')}
          participants={participantNames.get(expense.id) ?? []}
          onDelete={() => void onDelete(expense)}
        />
      ))}
    </section>
  );
}

function TripExpenseCard({
  expense,
  currency,
  hide,
  payer,
  participants,
  onDelete,
}: {
  expense: SplitExpense;
  currency: string;
  hide: boolean;
  payer?: Person;
  participants: string[];
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const category = getSplitCategoryMeta(expense.category);
  const methodLabel =
    expense.splitMethod === 'equal'
      ? 'Equal'
      : expense.splitMethod === 'exact'
        ? 'Exact'
        : expense.splitMethod === 'percentage'
          ? 'Percent'
          : 'Shares';

  return (
    <Card padded={false}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-xl dark:bg-brand-950/30">
          {category.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{expense.title}</span>
          <span className="block truncate text-xs text-slate-500">
            Paid by {payer?.isSelf ? 'You' : payer?.name ?? 'Unknown'} · {category.label}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-sm font-semibold tabular-nums">
            <Money value={{ amountMinor: expense.amountMinor, currency }} hide={hide} />
          </span>
          <ChevronDown
            size={16}
            className={open ? 'ml-auto mt-1 rotate-180 text-slate-400 transition-transform' : 'ml-auto mt-1 text-slate-400 transition-transform'}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Detail label="People" value={String(participants.length)} />
            <Detail label="Split" value={methodLabel} />
            <Detail label="Date" value={formatHumanDate(expense.date)} />
          </div>
          {participants.length > 0 && (
            <p className="text-xs text-slate-500">Split with {participants.join(', ')}</p>
          )}
          {expense.note && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {expense.note}
            </div>
          )}
          {onDelete && (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={onDelete}>
                Delete expense
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-800/60">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold">{value}</p>
    </div>
  );
}

function PeoplePanel({
  groupId,
  people,
  self,
  members,
  payers,
  shares,
  settlements,
}: {
  groupId: string;
  people: Person[];
  self: Person;
  members: Array<{ id: string; personId: string; active: boolean; deletedAt?: string }>;
  expenses: SplitExpense[];
  payers: Array<{ personId: string }>;
  shares: Array<{ personId: string }>;
  settlements: Array<{ fromPersonId: string; toPersonId: string }>;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const activeMembers = members.filter((member) => !member.deletedAt && member.active);
  const activeIds = new Set(activeMembers.map((member) => member.personId));
  const usedIds = new Set<string>();
  for (const payer of payers) usedIds.add(payer.personId);
  for (const share of shares) usedIds.add(share.personId);
  for (const settlement of settlements) {
    usedIds.add(settlement.fromPersonId);
    usedIds.add(settlement.toPersonId);
  }
  const personMap = new Map(people.map((person) => [person.id, person]));
  const candidates = people.filter((person) => !person.isSelf && !activeIds.has(person.id));

  const addNewPerson = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      const person = await personRepository.create({ name: name.trim() });
      await splitGroupMemberRepository.getOrCreate(groupId, person.id);
      setName('');
      toast.show(`${person.name} added to trip`, { variant: 'success' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not add person', { variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const addSaved = async (person: Person) => {
    await splitGroupMemberRepository.getOrCreate(groupId, person.id);
    toast.show(`${person.name} added to trip`, { variant: 'success' });
  };

  const removeFromTrip = async (memberId: string, person: Person) => {
    if (person.id === self.id || usedIds.has(person.id)) return;
    await splitGroupMemberRepository.setActive(memberId, false);
    toast.show(`${person.name} removed from this trip`);
  };

  return (
    <section className="space-y-4">
      <Card>
        <h2 className="text-sm font-semibold">Add participant</h2>
        <div className="mt-3 flex gap-2">
          <Input
            name="participant-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter name"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void addNewPerson();
              }
            }}
          />
          <Button onClick={() => void addNewPerson()} disabled={!name.trim() || adding}>
            <Plus size={16} /> Add
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {activeMembers.map((member) => {
          const person = personMap.get(member.personId);
          if (!person) return null;
          const used = usedIds.has(person.id);
          return (
            <Card key={member.id}>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                  {person.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{person.isSelf ? 'You' : person.name}</p>
                  <p className="text-xs text-slate-500">
                    {person.isSelf ? 'This is you' : used ? 'Used in trip activity' : 'No activity yet'}
                  </p>
                </div>
                {!person.isSelf && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={used}
                    onClick={() => void removeFromTrip(member.id, person)}
                    title={used ? 'People used in expenses or payments stay in the trip history.' : undefined}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {candidates.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Add a saved person</summary>
          <div className="space-y-1 border-t border-slate-100 p-2 dark:border-slate-800">
            {candidates.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => void addSaved(person)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span>{person.name}</span>
                <Plus size={15} className="text-slate-400" />
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function BalancesPanel({
  groupId,
  currency,
  people,
  self,
  members,
  balances,
  transfers,
  settlements,
  hide,
}: {
  groupId: string;
  currency: string;
  people: Person[];
  self: Person;
  members: Array<{ personId: string }>;
  balances: Map<string, number>;
  transfers: Array<{ fromPersonId: string; toPersonId: string; amountMinor: number }>;
  settlements: SplitSettlement[];
  hide: boolean;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [pendingUndoId, setPendingUndoId] = useState<string | null>(null);
  const personMap = new Map(people.map((person) => [person.id, person]));
  const memberPeople = members
    .map((member) => personMap.get(member.personId))
    .filter((person): person is Person => Boolean(person));

  const markPaid = async (transfer: { fromPersonId: string; toPersonId: string; amountMinor: number }) => {
    try {
      await splitSettlementRepository.create({
        groupId,
        fromPersonId: transfer.fromPersonId,
        toPersonId: transfer.toPersonId,
        amountMinor: transfer.amountMinor,
        currency,
        date: todayDateOnly(),
        note: 'Marked paid from optimized settlement',
      });
      toast.show('Payment recorded', { variant: 'success' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not record payment', { variant: 'error' });
    }
  };

  const undoPayment = async (settlement: SplitSettlement) => {
    await splitSettlementRepository.softDelete(settlement.id);
    setPendingUndoId(null);
    toast.show('Payment undone. Balances recalculated.', {
      action: {
        label: 'Restore',
        onClick: () => void splitSettlementRepository.restore(settlement.id),
      },
      duration: UNDO_TIMEOUT_MS,
    });
  };

  return (
    <section className="space-y-5">
      <Card>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {transfers.length === 0 ? <CheckCircle2 size={19} /> : <WalletCards size={19} />}
          </div>
          <div>
            <h2 className="font-semibold">{transfers.length === 0 ? 'All settled' : 'Optimized settlement'}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {transfers.length === 0
                ? 'No outstanding payments in this trip.'
                : `${transfers.length} payment${transfers.length === 1 ? '' : 's'} remaining. Mark a payment when it is actually made.`}
            </p>
          </div>
        </div>
      </Card>

      {transfers.length > 0 && (
        <div className="space-y-2">
          {transfers.map((transfer, index) => {
            const from = personMap.get(transfer.fromPersonId);
            const to = personMap.get(transfer.toPersonId);
            return (
              <Card key={`${transfer.fromPersonId}-${transfer.toPersonId}-${index}`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {from?.isSelf ? 'You' : from?.name ?? 'Unknown'}
                        <ArrowRight size={14} className="mx-1 inline text-slate-400" />
                        {to?.isSelf ? 'You' : to?.name ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500">Recommended transfer</p>
                    </div>
                    <span className="text-base font-bold tabular-nums">
                      <Money value={{ amountMinor: transfer.amountMinor, currency }} hide={hide} />
                    </span>
                  </div>
                  <Button block onClick={() => void markPaid(transfer)}>
                    Mark paid
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {settlements.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Recorded payments</h2>
          <div className="space-y-2">
            {settlements.map((settlement) => {
              const from = personMap.get(settlement.fromPersonId);
              const to = personMap.get(settlement.toPersonId);
              const confirmingUndo = pendingUndoId === settlement.id;
              return (
                <Card key={settlement.id}>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {from?.isSelf ? 'You' : from?.name ?? 'Unknown'} paid {to?.isSelf ? 'you' : to?.name ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-500">{formatHumanDate(settlement.date)}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-emerald-600">
                        <Money value={{ amountMinor: settlement.amountMinor, currency }} hide={hide} />
                      </p>
                    </div>

                    {confirmingUndo ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                        <p className="text-xs text-amber-900 dark:text-amber-200">
                          Undoing this payment recalculates the trip balance and may make a payment due again.
                        </p>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setPendingUndoId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => void undoPayment(settlement)}>
                            Undo payment
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setPendingUndoId(settlement.id)}
                          className="text-xs text-slate-500 hover:text-rose-600"
                        >
                          Undo payment
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Summary</h2>
        <ul className="space-y-2">
          {memberPeople.map((person) => (
            <BalanceRow
              key={person.id}
              person={person}
              amountMinor={balances.get(person.id) ?? 0}
              currency={currency}
              selfPersonId={self.id}
            />
          ))}
        </ul>
      </div>

      <Button
        variant="secondary"
        block
        onClick={() => navigate({ to: '/split/group/$groupId/settle', params: { groupId } })}
      >
        Record a custom payment
      </Button>
    </section>
  );
}

function SearchPanel({
  expenses,
  currency,
  hide,
  personMap,
  expensePayers,
  participantNames,
}: {
  expenses: SplitExpense[];
  currency: string;
  hide: boolean;
  personMap: Map<string, Person>;
  expensePayers: Map<string, string>;
  participantNames: Map<string, string[]>;
}) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalized) return expenses;
    return expenses.filter((expense) => {
      const payer = personMap.get(expensePayers.get(expense.id) ?? '');
      const category = getSplitCategoryMeta(expense.category);
      return [expense.title, expense.note ?? '', payer?.name ?? '', category.label]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [expenses, expensePayers, normalized, personMap]);

  return (
    <section className="space-y-3">
      <Input
        name="trip-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search title, payer, category or note…"
        autoFocus
      />
      <p className="text-xs text-slate-500">
        Search is read-only. Open the Expenses tab to remove a trip expense.
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={30} />}
          title="No results"
          description="Try a different title, person, category or note."
        />
      ) : (
        filtered.map((expense) => (
          <TripExpenseCard
            key={expense.id}
            expense={expense}
            currency={currency}
            hide={hide}
            payer={personMap.get(expensePayers.get(expense.id) ?? '')}
            participants={participantNames.get(expense.id) ?? []}
          />
        ))
      )}
    </section>
  );
}
