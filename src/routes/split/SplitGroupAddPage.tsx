/**
 * Add expense / settlement / member page.
 *
 * Spec §39 route: /split/group/$groupId/add with a
 * `?type=expense|settlement|member` search param. V1
 * focuses on the expense flow; the other modes route
 * the user to the appropriate existing page.
 */

import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card, DateInput, Input, MoneyInput, Spinner, Textarea, useToast } from '@components/ui';
import { useSplitGroup, useSplitGroupMembers } from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { splitExpenseRepository } from '@modules/split/repositories/splitExpenseRepository';
import { splitSettlementRepository } from '@modules/split/repositories/splitSettlementRepository';
import { splitGroupMemberRepository } from '@modules/split/repositories/splitGroupMemberRepository';
import { SplitMethodSelector } from '@modules/split/components/SplitMethodSelector';
import { SplitAllocationEditor } from '@modules/split/components/SplitAllocationEditor';
import { MemberSelector } from '@modules/split/components/MemberSelector';
import { PayerSelector } from '@modules/split/components/PayerSelector';
import { todayDateOnly } from '@shared/dates';
import { decimalToMinor } from '@shared/money';
import type { SplitMethod } from '@db/schema';
import type { Person } from '@db/schema';

export function SplitGroupAddPage() {
  const params = useParams({ from: '/split/group/$groupId/add' });
  const groupId = params.groupId;
  const navigate = useNavigate();
  const search = useSearch({ from: '/split/group/$groupId/add' }) as { type?: 'expense' | 'settlement' | 'member' };
  const type = search?.type ?? 'expense';

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
        <p className="mt-2 text-sm text-slate-500">This group is no longer accepting new entries.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          {type === 'settlement' ? 'New settlement' : type === 'member' ? 'Add member' : 'New expense'}
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })}
        >
          Cancel
        </Button>
      </div>

      {type === 'expense' && <ExpenseForm groupId={groupId} currency={group.currency} />}
      {type === 'settlement' && (
        <SettlementForm
          groupId={groupId}
          currency={group.currency}
          onDone={() => navigate({ to: '/split/group/$groupId', params: { groupId } })}
        />
      )}
      {type === 'member' && (
        <AddMemberForm
          groupId={groupId}
          onDone={() => navigate({ to: '/split/group/$groupId/settings', params: { groupId } })}
        />
      )}
    </div>
  );
}

interface ExpenseFormProps {
  groupId: string;
  currency: string;
}

function ExpenseForm({ groupId, currency }: ExpenseFormProps) {
  const navigate = useNavigate();
  const people = usePeople();
  const self = useSelf();
  const groupMembers = useSplitGroupMembers(groupId, true);
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(todayDateOnly());
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<SplitMethod>('equal');
  const [payerId, setPayerId] = useState<string | undefined>();
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [allocation, setAllocation] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Default: the self person pays and is a participant.
  useMemo(() => {
    if (self && !payerId) setPayerId(self.id);
  }, [self, payerId]);

  if (!people || !self || groupMembers === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  // Resolve which people to show in the participant picker:
  // every active group member, plus any historical member.
  const memberPersonIds = new Set(groupMembers.filter((m) => m.active).map((m) => m.personId));
  const participantPeople: Person[] = people.filter((p) => memberPersonIds.has(p.id));

  const onToggleParticipant = (ids: string[]) => {
    setParticipantIds(ids);
    // Clean up allocation entries for removed participants.
    setAllocation((cur) => {
      const next: Record<string, string> = {};
      for (const id of ids) next[id] = cur[id] ?? '';
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    if (!payerId) {
      setError('Payer is required');
      return;
    }
    if (participantIds.length === 0) {
      setError('At least one participant is required');
      return;
    }
    setSubmitting(true);
    try {
      const allocationInput = buildAllocationInput(method, participantIds, allocation, amount, currency);
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
      // Ensure participant rows exist (idempotent).
      for (const pid of participantIds) {
        await splitGroupMemberRepository.getOrCreate(groupId, pid);
      }
      toast.show('Expense added', { variant: 'success' });
      navigate({ to: '/split/group/$groupId', params: { groupId } });
      void expense;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Dinner, Hotel, Taxi…"
        autoFocus
        required
      />
      <MoneyInput
        label="Amount"
        currency={currency}
        value={amount}
        onChange={setAmount}
      />
      <DateInput value={date} onChange={setDate} />
      <PayerSelector
        payerId={payerId}
        amountMinor={amount}
        currency={currency}
        onPayerChange={setPayerId}
        onAmountChange={setAmount}
      />
      <div>
        <label className="label">Split method</label>
        <SplitMethodSelector value={method} onChange={(m) => setMethod(m)} />
      </div>

      <div>
        <label className="label">Participants</label>
        <MemberSelector
          people={participantPeople}
          selectedIds={participantIds}
          onChange={onToggleParticipant}
        />
      </div>

      {participantIds.length > 0 && (
        <SplitAllocationEditor
          method={method}
          participants={participantPeople.filter((p) => participantIds.includes(p.id))}
          currency={currency}
          totalAmountMinor={amount}
          values={allocation}
          onChange={(personId, raw) =>
            setAllocation((cur) => ({ ...cur, [personId]: raw }))
          }
          error={
            method === 'exact' && amount > 0 && participantIds.length > 0
              ? validateExact(participantIds, allocation, amount, currency)
              : undefined
          }
        />
      )}

      <Textarea
        label="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save expense'}
        </Button>
      </div>
    </form>
  );
}

function validateExact(
  participantIds: string[],
  allocation: Record<string, string>,
  amount: number,
  currency: string,
): string | undefined {
  let total = 0;
  for (const id of participantIds) {
    const raw = allocation[id] ?? '';
    if (raw.trim() === '') return 'Every participant needs an exact amount';
    try {
      total += decimalToMinor(raw, currency);
    } catch {
      return 'Invalid amount';
    }
  }
  if (total !== amount) return 'Exact amounts must sum to the expense total';
  return undefined;
}

interface SettlementFormProps {
  groupId: string;
  currency: string;
  onDone: () => void;
}

function SettlementForm({ groupId, currency, onDone }: SettlementFormProps) {
  const people = usePeople();
  const groupMembers = useSplitGroupMembers(groupId, true);
  const toast = useToast();
  const [fromId, setFromId] = useState<string | undefined>();
  const [toId, setToId] = useState<string | undefined>();
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(todayDateOnly());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!people || groupMembers === undefined) {
    return <Spinner />;
  }

  const memberPersonIds = new Set(groupMembers.filter((m) => m.active).map((m) => m.personId));
  const memberPeople = people.filter((p) => memberPersonIds.has(p.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!fromId || !toId) {
      setError('Both payer and receiver are required');
      return;
    }
    if (fromId === toId) {
      setError('From and to must be different people');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    setSubmitting(true);
    try {
      await splitSettlementRepository.create({
        groupId,
        fromPersonId: fromId,
        toPersonId: toId,
        amountMinor: amount,
        currency,
        date,
        note: note.trim() || undefined,
      });
      toast.show('Settlement recorded', { variant: 'success' });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record settlement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="label">From</label>
        <select
          className="input h-11"
          value={fromId ?? ''}
          onChange={(e) => setFromId(e.target.value || undefined)}
        >
          <option value="">—</option>
          {memberPeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isSelf ? ' (me)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="label">To</label>
        <select
          className="input h-11"
          value={toId ?? ''}
          onChange={(e) => setToId(e.target.value || undefined)}
        >
          <option value="">—</option>
          {memberPeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isSelf ? ' (me)' : ''}
            </option>
          ))}
        </select>
      </div>
      <MoneyInput value={amount} currency={currency} onChange={setAmount} label="Amount" />
      <DateInput value={date} onChange={setDate} />
      <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Record'}
        </Button>
      </div>
    </form>
  );
}

function AddMemberForm({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const people = usePeople();
  const groupMembers = useSplitGroupMembers(groupId, true);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!people || groupMembers === undefined) return <Spinner />;

  const memberPersonIds = new Set(groupMembers.filter((m) => m.active).map((m) => m.personId));
  const candidates = people.filter((p) => !memberPersonIds.has(p.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    for (const pid of selected) {
      await splitGroupMemberRepository.getOrCreate(groupId, pid);
    }
    onDone();
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <p className="text-sm text-slate-500">Add people to this group.</p>
      <MemberSelector people={candidates} selectedIds={selected} onChange={setSelected} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || selected.length === 0}>
          Add {selected.length > 0 ? `(${selected.length})` : ''}
        </Button>
      </div>
    </form>
  );
}

function buildAllocationInput(
  method: SplitMethod,
  participantIds: string[],
  allocation: Record<string, string>,
  amount: number,
  currency: string,
) {
  switch (method) {
    case 'equal':
      return { method: 'equal' as const };
    case 'exact': {
      const amountsByPersonId: Record<string, number> = {};
      for (const id of participantIds) {
        const raw = allocation[id] ?? '0';
        amountsByPersonId[id] = decimalToMinor(raw, currency);
      }
      void amount;
      return { method: 'exact' as const, amountsByPersonId };
    }
    case 'percentage': {
      const percentagesByPersonId: Record<string, number> = {};
      for (const id of participantIds) {
        percentagesByPersonId[id] = Number(allocation[id] ?? '0');
      }
      return { method: 'percentage' as const, percentagesByPersonId };
    }
    case 'shares': {
      const sharesByPersonId: Record<string, number> = {};
      for (const id of participantIds) {
        sharesByPersonId[id] = Number(allocation[id] ?? '0');
      }
      return { method: 'shares' as const, sharesByPersonId };
    }
  }
}

// keep live reference for the typecheck unused-warning heuristic
void useLiveQuery;
