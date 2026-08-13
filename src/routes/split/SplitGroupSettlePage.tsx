import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button, DateInput, Input, Money, MoneyInput, Spinner, useToast } from '@components/ui';
import { useSplitGroup, useSplitGroupBalances, useSplitGroupMembers } from '@modules/split/queries';
import { usePeople, useSelf } from '@shared/people/queries';
import { useAppSettings } from '@shared/settings/useSettings';
import { splitSettlementRepository } from '@modules/split/repositories/splitSettlementRepository';
import { todayDateOnly } from '@shared/dates';

export function SplitGroupSettlePage() {
  const { groupId } = useParams({ from: '/split/group/$groupId/settle' });
  const navigate = useNavigate();
  const group = useSplitGroup(groupId);
  const balances = useSplitGroupBalances(groupId);
  const people = usePeople();
  const self = useSelf();
  const settings = useAppSettings();
  const members = useSplitGroupMembers(groupId, true);
  const toast = useToast();
  const search = useSearch({ from: '/split/group/$groupId/settle' }) as { from?: string; to?: string };

  const [fromId, setFromId] = useState<string>();
  const [toId, setToId] = useState<string>();
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayDateOnly());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!self) return;
    if (search.from) setFromId(search.from);
    if (search.to) setToId(search.to);
  }, [search.from, search.to, self]);

  if (!group || !balances || !people || !self || !settings || members === undefined) {
    return <div className="flex justify-center py-10"><Spinner /></div>;
  }

  if (group.deletedAt || group.archived) {
    return <div className="space-y-3"><p className="text-sm text-slate-500">Payments cannot be added to an archived or deleted trip.</p><Button variant="secondary" onClick={() => navigate({ to: '/split' })}>Back to Split</Button></div>;
  }

  const memberPersonIds = new Set(members.map((member) => member.personId));
  const memberPeople = people.filter((person) => memberPersonIds.has(person.id));
  const personMap = new Map(people.map((person) => [person.id, person]));
  const hide = settings.hideAmounts;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    if (!fromId || !toId) return setError('Both payer and receiver are required.');
    if (!memberPersonIds.has(fromId) || !memberPersonIds.has(toId)) return setError('Choose people from this trip.');
    if (fromId === toId) return setError('Payer and receiver must be different people.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Amount must be greater than zero.');

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
      toast.show('Payment recorded', { variant: 'success' });
      navigate({ to: '/split/group/$groupId', params: { groupId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <header className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0"><h1 className="truncate text-lg font-semibold">Record payment</h1><p className="truncate text-xs text-slate-500">{group.name}</p></div>
        <button type="button" onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })} className="min-h-11 shrink-0 px-2 text-sm font-medium text-brand-600 hover:underline">Cancel</button>
      </header>

      {balances.transfers.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Suggestions</h2>
          <ul className="space-y-1">
            {balances.transfers.map((transfer, index) => {
              const from = personMap.get(transfer.fromPersonId);
              const to = personMap.get(transfer.toPersonId);
              return (
                <li key={`${transfer.fromPersonId}-${transfer.toPersonId}-${index}`}>
                  <button
                    type="button"
                    onClick={() => { setFromId(transfer.fromPersonId); setToId(transfer.toPersonId); setAmount(transfer.amountMinor); }}
                    className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    <span className="min-w-0 truncate">{from?.isSelf ? 'You' : from?.name ?? '?'} → {to?.isSelf ? 'You' : to?.name ?? '?'}</span>
                    <span className="shrink-0 font-semibold tabular-nums"><Money value={{ amountMinor: transfer.amountMinor, currency: group.currency }} hide={hide} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1"><label className="label">Payer</label><select className="input h-11" value={fromId ?? ''} onChange={(event) => setFromId(event.target.value || undefined)}><option value="">Choose…</option>{memberPeople.map((person) => <option key={person.id} value={person.id}>{person.name}{person.isSelf ? ' (me)' : ''}</option>)}</select></div>
          <div className="space-y-1"><label className="label">Receiver</label><select className="input h-11" value={toId ?? ''} onChange={(event) => setToId(event.target.value || undefined)}><option value="">Choose…</option>{memberPeople.map((person) => <option key={person.id} value={person.id}>{person.name}{person.isSelf ? ' (me)' : ''}</option>)}</select></div>
        </div>
        <MoneyInput value={amount} currency={group.currency} onChange={setAmount} label="Amount" />
        <DateInput value={date} onChange={setDate} label="Date" />
        <Input label="Note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" maxLength={500} />
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        <div className="grid grid-cols-2 gap-2"><Button type="button" variant="ghost" onClick={() => navigate({ to: '/split/group/$groupId', params: { groupId } })} disabled={submitting}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Record payment'}</Button></div>
      </form>
    </div>
  );
}
