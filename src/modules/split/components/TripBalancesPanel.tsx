import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, CheckCircle2, Share2, WalletCards } from 'lucide-react';
import { Button, Card, Money, useCelebration, useToast } from '@components/ui';
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

function transferKey(transfer: { fromPersonId: string; toPersonId: string; amountMinor: number }): string {
  return `${transfer.fromPersonId}:${transfer.toPersonId}:${transfer.amountMinor}`;
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
  const { celebrate } = useCelebration();
  const [pendingUndoId, setPendingUndoId] = useState<string | null>(null);
  const [savingPaymentKey, setSavingPaymentKey] = useState<string | null>(null);
  const savingPaymentRef = useRef<string | null>(null);
  const personMap = new Map(people.map((person) => [person.id, person]));
  const memberPeople = members
    .map((member) => personMap.get(member.personId))
    .filter((person): person is Person => Boolean(person));

  const markPaid = async (transfer: { fromPersonId: string; toPersonId: string; amountMinor: number }) => {
    const key = transferKey(transfer);
    if (savingPaymentRef.current) return;
    savingPaymentRef.current = key;
    setSavingPaymentKey(key);

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
      const closesTrip = transfers.length === 1;
      toast.show(closesTrip ? 'Trip settled' : 'Payment recorded', { variant: 'success' });
      celebrate({ kind: closesTrip ? 'settled' : 'added', message: closesTrip ? 'Trip settled' : 'Payment recorded' });
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not record payment', { variant: 'error' });
    } finally {
      savingPaymentRef.current = null;
      setSavingPaymentKey(null);
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
    <section className="space-y-6">
      <Card className={transfers.length === 0 ? 'border-emerald-500/[0.15] bg-emerald-500/[0.045]' : undefined}>
        <div className="flex items-start gap-3">
          <div className={transfers.length === 0
            ? 'mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[15px] bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-300'
            : 'mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[15px] bg-brand-500/10 text-brand-600 dark:text-brand-300'}>
            {transfers.length === 0 ? <CheckCircle2 size={19} /> : <WalletCards size={19} />}
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">{transfers.length === 0 ? 'All settled' : 'Suggested payments'}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {transfers.length === 0
                ? 'No outstanding payments in this trip.'
                : `${transfers.length} payment${transfers.length === 1 ? '' : 's'} remaining. These suggestions reduce the number of transfers.`}
            </p>
          </div>
        </div>
      </Card>

      {transfers.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Settle up</h2>
          <div className="stagger-list space-y-2.5">
            {transfers.map((transfer, index) => {
              const from = personMap.get(transfer.fromPersonId);
              const to = personMap.get(transfer.toPersonId);
              const key = transferKey(transfer);
              const saving = savingPaymentKey === key;
              return (
                <Card key={`${transfer.fromPersonId}-${transfer.toPersonId}-${index}`} className="surface-lift">
                  <div className="space-y-4">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <PersonDot name={from?.isSelf ? 'You' : from?.name ?? 'Unknown'} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold tracking-[-0.01em]">
                            {from?.isSelf ? 'You' : from?.name ?? 'Unknown'}
                            <ArrowRight size={13} className="mx-1 inline text-slate-400" />
                            {to?.isSelf ? 'You' : to?.name ?? 'Unknown'}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">Suggested transfer</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[17px] font-semibold tracking-[-0.02em] tabular-nums">
                        <Money value={{ amountMinor: transfer.amountMinor, currency }} hide={hideAmounts} />
                      </span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-2">
                      <Button variant="secondary" onClick={() => void shareTransfer(transfer)} aria-label="Share payment details">
                        <Share2 size={15} /> Share
                      </Button>
                      <Button
                        onClick={() => void markPaid(transfer)}
                        disabled={savingPaymentKey !== null}
                      >
                        {saving ? 'Recording…' : 'Mark paid'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {settlements.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Recorded payments</h2>
          <div className="space-y-2.5">
            {settlements.map((settlement) => {
              const from = personMap.get(settlement.fromPersonId);
              const to = personMap.get(settlement.toPersonId);
              const confirmingUndo = pendingUndoId === settlement.id;
              return (
                <Card key={settlement.id}>
                  <div className="space-y-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><CheckCircle2 size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium tracking-[-0.01em]">
                          {from?.isSelf ? 'You' : from?.name ?? 'Unknown'} paid {to?.isSelf ? 'you' : to?.name ?? 'Unknown'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{formatHumanDate(settlement.date)}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
                        <Money value={{ amountMinor: settlement.amountMinor, currency }} hide={hideAmounts} />
                      </p>
                    </div>
                    {confirmingUndo ? (
                      <div className="rounded-[17px] border border-amber-500/20 bg-amber-500/[0.07] p-3">
                        <p className="text-xs leading-5 text-amber-900 dark:text-amber-200">
                          Undoing this payment recalculates the trip balance and may make a payment due again.
                        </p>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setPendingUndoId(null)}>Cancel</Button>
                          <Button size="sm" variant="secondary" onClick={() => void undoPayment(settlement)}>Undo payment</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button type="button" onClick={() => setPendingUndoId(settlement.id)} className="min-h-9 rounded-xl px-2 text-xs font-medium text-slate-400 transition-colors hover:bg-rose-500/[0.06] hover:text-rose-600">Undo payment</button>
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
        <h2 className="section-title mb-3">Everyone's position</h2>
        <ul className="stagger-list space-y-2">
          {memberPeople.map((person) => (
            <BalanceRow key={person.id} person={person} amountMinor={balances.get(person.id) ?? 0} currency={currency} selfPersonId={self.id} />
          ))}
        </ul>
      </div>

      <Button variant="secondary" block onClick={() => navigate({ to: '/split/group/$groupId/settle', params: { groupId } })}>
        Record a custom payment
      </Button>
    </section>
  );
}

function PersonDot({ name }: { name: string }) {
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-slate-950 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">{name.charAt(0).toLocaleUpperCase()}</span>;
}
