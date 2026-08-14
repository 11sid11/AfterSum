import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, CheckCircle2, Share2, WalletCards } from 'lucide-react';
import { Button, Card, Money, useToast } from '@components/ui';
import type { Person, SplitSettlement } from '@db/schema';
import { BalanceRow } from './BalanceRow';
import { splitSettlementRepository } from '../repositories/splitSettlementRepository';
import { formatHumanDate, todayDateOnly } from '@shared/dates';
import { formatMoney } from '@shared/money';
import { UNDO_TIMEOUT_MS } from '@app/constants';

interface TripBalancesPanelProps {
  groupId: string;
  groupName: string;
  currency: string;
  people: Person[];
  self: Person;
  members: Array<{ personId: string }>;
  balances: Map<string, number>;
  transfers: Array<{ fromPersonId: string; toPersonId: string; amountMinor: number }>;
  settlements: SplitSettlement[];
  hideAmounts: boolean;
}

export function TripBalancesPanel({
  groupId,
  groupName,
  currency,
  people,
  self,
  members,
  balances,
  transfers,
  settlements,
  hideAmounts,
}: TripBalancesPanelProps) {
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
        note: 'Marked paid from suggested settlement',
      });
      toast.show('Payment recorded', { variant: 'success' });
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not record payment', { variant: 'error' });
    }
  };

  const undoPayment = async (settlement: SplitSettlement) => {
    try {
      await splitSettlementRepository.softDelete(settlement.id);
      setPendingUndoId(null);
      toast.show('Payment undone. Balances recalculated.', {
        action: { label: 'Restore', onClick: () => void splitSettlementRepository.restore(settlement.id) },
        duration: UNDO_TIMEOUT_MS,
      });
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not undo payment', { variant: 'error' });
    }
  };

  const shareTransfer = async (transfer: { fromPersonId: string; toPersonId: string; amountMinor: number }) => {
    const from = personMap.get(transfer.fromPersonId);
    const to = personMap.get(transfer.toPersonId);
    const fromName = from?.isSelf ? 'You' : from?.name ?? 'Unknown';
    const toName = to?.isSelf ? 'You' : to?.name ?? 'Unknown';
    const text = `${groupName}: ${fromName} → ${toName} ${formatMoney({ amountMinor: transfer.amountMinor, currency })}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: `${groupName} payment`, text });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.show('Payment details copied');
        return;
      }
      window.prompt('Copy payment details', text);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.show('Could not share payment details', { variant: 'error' });
    }
  };

  return (
    <section className="space-y-5">
      <Card>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {transfers.length === 0 ? <CheckCircle2 size={19} /> : <WalletCards size={19} />}
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold">{transfers.length === 0 ? 'All settled' : 'Suggested payments'}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {transfers.length === 0
                ? 'No outstanding payments in this trip.'
                : `${transfers.length} payment${transfers.length === 1 ? '' : 's'} remaining. These suggestions reduce the number of transfers.`}
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
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {from?.isSelf ? 'You' : from?.name ?? 'Unknown'}
                        <ArrowRight size={14} className="mx-1 inline text-slate-400" />
                        {to?.isSelf ? 'You' : to?.name ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500">Suggested transfer</p>
                    </div>
                    <span className="shrink-0 text-base font-bold tabular-nums">
                      <Money value={{ amountMinor: transfer.amountMinor, currency }} hide={hideAmounts} />
                    </span>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <Button variant="secondary" onClick={() => void shareTransfer(transfer)} aria-label="Share payment details">
                      <Share2 size={16} /> Share
                    </Button>
                    <Button onClick={() => void markPaid(transfer)}>Mark paid</Button>
                  </div>
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
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {from?.isSelf ? 'You' : from?.name ?? 'Unknown'} paid {to?.isSelf ? 'you' : to?.name ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-500">{formatHumanDate(settlement.date)}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600">
                        <Money value={{ amountMinor: settlement.amountMinor, currency }} hide={hideAmounts} />
                      </p>
                    </div>
                    {confirmingUndo ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                        <p className="text-xs text-amber-900 dark:text-amber-200">
                          Undoing this payment recalculates the trip balance and may make a payment due again.
                        </p>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setPendingUndoId(null)}>Cancel</Button>
                          <Button size="sm" variant="secondary" onClick={() => void undoPayment(settlement)}>Undo payment</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setPendingUndoId(settlement.id)}
                          className="min-h-10 px-2 text-xs text-slate-500 hover:text-rose-600"
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
