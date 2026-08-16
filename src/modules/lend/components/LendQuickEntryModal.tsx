import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button, DateInput, Modal, Money, MoneyInput, Textarea, useCelebration, useToast } from '@components/ui';
import type { Person } from '@db/schema';
import { todayDateOnly } from '@shared/dates';
import type { CurrencyCode } from '@shared/money';
import {
  quickLendEntryLimitMinor,
  resolveQuickLendEntryType,
  wouldQuickLendEntryCrossBalance,
  type LendQuickDirection,
} from '../domain/quickEntry';
import { lendEntryRepository } from '../repositories/lendEntryRepository';
import { lendLedgerRepository } from '../repositories/lendLedgerRepository';

interface LendQuickEntryModalProps {
  open: boolean;
  direction: LendQuickDirection;
  person: Person;
  currentBalanceMinor: number;
  currency: CurrencyCode;
  hideAmounts: boolean;
  onClose: () => void;
}

const CROSS_BALANCE_MESSAGE =
  'This would cross the current balance. Settle it first, then record the remainder separately.';

export function LendQuickEntryModal({
  open,
  direction,
  person,
  currentBalanceMinor,
  currency,
  hideAmounts,
  onClose,
}: LendQuickEntryModalProps) {
  const toast = useToast();
  const { celebrate } = useCelebration();
  const [amountMinor, setAmountMinor] = useState(0);
  const [date, setDate] = useState(todayDateOnly());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setAmountMinor(0);
    setDate(todayDateOnly());
    setNote('');
    setSubmitting(false);
    setError(undefined);
  }, [open, direction]);

  const limitMinor = quickLendEntryLimitMinor(direction, currentBalanceMinor);
  const crossesBalance = wouldQuickLendEntryCrossBalance(
    direction,
    currentBalanceMinor,
    amountMinor,
  );
  const amountError = error ?? (crossesBalance ? CROSS_BALANCE_MESSAGE : undefined);
  const title = direction === 'gave' ? `You gave ${person.name}` : `You got from ${person.name}`;
  const isRepayment = limitMinor !== undefined;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (crossesBalance) {
      setError(CROSS_BALANCE_MESSAGE);
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const ledger = await lendLedgerRepository.getOrCreate(person.id, currency);
      const type = resolveQuickLendEntryType(direction, currentBalanceMinor);
      await lendEntryRepository.create({
        ledgerId: ledger.id,
        type,
        amountMinor,
        date,
        note: note.trim() || undefined,
      });

      const settled = limitMinor !== undefined && amountMinor === limitMinor;
      const message = settled ? 'Balance settled' : 'Entry recorded';
      toast.show(message, { variant: 'success' });
      celebrate({ kind: 'added', message });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save entry');
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !submitting && onClose()} title={title} className="max-w-md">
      <form className="space-y-4" onSubmit={(event) => void save(event)}>
        <div className={direction === 'gave'
          ? 'flex items-start gap-3 rounded-[18px] border border-rose-500/15 bg-rose-500/[0.055] px-3.5 py-3 text-rose-800 dark:text-rose-200'
          : 'flex items-start gap-3 rounded-[18px] border border-emerald-500/15 bg-emerald-500/[0.055] px-3.5 py-3 text-emerald-800 dark:text-emerald-200'}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-white/70 shadow-soft-xs dark:bg-white/[0.07]">
            {direction === 'gave' ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{direction === 'gave' ? 'Money left you' : 'Money came to you'}</p>
            <p className="mt-0.5 text-xs leading-5 opacity-80">
              {isRepayment
                ? 'This counts as repayment against the current balance.'
                : direction === 'gave'
                  ? `${person.name} will owe you this amount.`
                  : `You will owe ${person.name} this amount.`}
            </p>
          </div>
        </div>

        <MoneyInput
          label="Amount"
          value={amountMinor}
          currency={currency}
          onChange={(value) => {
            setAmountMinor(value);
            if (error) setError(undefined);
          }}
          autoFocus
          error={amountError}
        />

        {limitMinor !== undefined && (
          <p className="text-xs leading-5 text-slate-500">
            Up to{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              <Money value={{ amountMinor: limitMinor, currency }} hide={hideAmounts} />
            </span>{' '}
            will settle this balance. Any extra amount should be recorded as a separate entry.
          </p>
        )}

        <DateInput label="Date" value={date} onChange={setDate} />
        <Textarea
          label="Note (optional)"
          name="lend-quick-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          placeholder="What was this for?"
        />

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || amountMinor <= 0 || crossesBalance}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
