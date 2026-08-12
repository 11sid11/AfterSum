/**
 * Record a settlement.
 *
 * The form has From / To / Amount / Date / Note. The default
 * `from` person is whichever side the user "owes" the most
 * to keep the flow friction-free.
 */

import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button, DateInput, Input, MoneyInput, Spinner, Textarea, useToast } from '@components/ui';
import { useSplitGroup, useSplitGroupBalances, useSplitGroupMembers } from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { splitSettlementRepository } from '@modules/split/repositories/splitSettlementRepository';
import { todayDateOnly } from '@shared/dates';

export function SplitGroupSettlePage() {
  const params = useParams({ from: '/split/group/$groupId/settle' });
  const groupId = params.groupId;
  const navigate = useNavigate();
  const group = useSplitGroup(groupId);
  const balances = useSplitGroupBalances(groupId);
  const people = usePeople();
  const self = useSelf();
  const members = useSplitGroupMembers(groupId, true);
  const toast = useToast();

  const [fromId, setFromId] = useState<string | undefined>();
  const [toId, setToId] = useState<string | undefined>();
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(todayDateOnly());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // search params may pass suggested from/to (work.md §50: "from person
  // (defaults to the owed person)").
  const search = useSearch({ from: '/split/group/$groupId/settle' }) as {
    from?: string;
    to?: string;
  };

  useEffect(() => {
    if (!self) return;
    if (search.from) setFromId(search.from);
    if (search.to) setToId(search.to);
  }, [search, self]);

  if (!group || !balances || !people || !self || members === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const memberPersonIds = new Set(members.filter((m) => m.active).map((m) => m.personId));
  const memberPeople = people.filter((p) => memberPersonIds.has(p.id));
  const personMap = new Map(people.map((p) => [p.id, p]));

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
        currency: group.currency,
        date,
        note: note.trim() || undefined,
      });
      toast.show('Settlement recorded', { variant: 'success' });
      navigate({ to: '/split/group/$groupId', params: { groupId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record settlement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settle · {group.name}</h1>
        <button
          type="button"
          onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })}
          className="text-sm text-brand-600 hover:underline"
        >
          Cancel
        </button>
      </div>

      {/* Quick suggestions */}
      {balances.transfers.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Suggestions
          </h2>
          <ul className="space-y-1">
            {balances.transfers.map((t, i) => {
              const from = personMap.get(t.fromPersonId);
              const to = personMap.get(t.toPersonId);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setFromId(t.fromPersonId);
                      setToId(t.toPersonId);
                      setAmount(t.amountMinor);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    {from?.name ?? '?'} → {to?.name ?? '?'} ·{' '}
                    <span className="font-semibold tabular-nums">
                      {(t.amountMinor / 100).toFixed(2)} {group.currency}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="label">From</label>
          <select
            className="input h-11"
            value={fromId ?? ''}
            onChange={(e) => setFromId(e.target.value || undefined)}
            aria-label="From"
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
            aria-label="To"
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
        <MoneyInput
          value={amount}
          currency={group.currency}
          onChange={setAmount}
          label="Amount"
        />
        <DateInput value={date} onChange={setDate} />
        <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        <Textarea
          label="Reason (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="hidden"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Record'}
          </Button>
        </div>
      </form>
    </div>
  );
}
