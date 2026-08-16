import { Sliders, Trash2 } from 'lucide-react';
import { Money, MoneySigned, useToast } from '@components/ui';
import type { LendEntry } from '@db/schema';
import { formatHumanDate } from '@shared/dates';
import type { CurrencyCode } from '@shared/money';
import { lendEntryCashDirection } from '../domain/quickEntry';
import { entryToSignedAmount } from '../domain/signs';
import { lendEntryRepository } from '../repositories/lendEntryRepository';

interface LendLedgerEntryRowProps {
  entry: LendEntry;
  runningBalanceMinor: number;
  currency: CurrencyCode;
  hideAmounts: boolean;
}

export function LendLedgerEntryRow({
  entry,
  runningBalanceMinor,
  currency,
  hideAmounts,
}: LendLedgerEntryRowProps) {
  const toast = useToast();
  const direction = lendEntryCashDirection(entry);
  const isAdjustment = direction === 'adjustment';
  const actionLabel = isAdjustment ? 'Adjustment' : direction === 'gave' ? 'You gave' : 'You got';

  const balanceTone = runningBalanceMinor > 0
    ? 'bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300'
    : runningBalanceMinor < 0
      ? 'bg-rose-500/[0.08] text-rose-700 dark:text-rose-300'
      : 'bg-slate-900/[0.045] text-slate-500 dark:bg-white/[0.055] dark:text-slate-300';

  return (
    <div className="flex min-w-0 items-stretch overflow-hidden rounded-[18px] border border-slate-900/[0.065] bg-white shadow-soft-xs dark:border-white/[0.075] dark:bg-[#141821] dark:shadow-none">
      <div className="min-w-0 flex-1 px-3.5 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">{formatHumanDate(entry.date)}</p>
            {entry.note && (
              <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-700 dark:text-slate-200">
                {entry.note}
              </p>
            )}
            <div className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${balanceTone}`}>
              <span>{runningBalanceMinor > 0 ? 'Owes you' : runningBalanceMinor < 0 ? 'You owe' : 'Settled'}</span>
              <Money
                value={{ amountMinor: Math.abs(runningBalanceMinor), currency }}
                hide={hideAmounts}
              />
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className={direction === 'gave'
              ? 'text-[10px] font-semibold uppercase tracking-[0.09em] text-rose-500'
              : direction === 'got'
                ? 'text-[10px] font-semibold uppercase tracking-[0.09em] text-emerald-600 dark:text-emerald-400'
                : 'text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400'}>
              {actionLabel}
            </p>
            <div className={direction === 'gave'
              ? 'mt-1 text-base font-semibold tabular-nums text-rose-700 dark:text-rose-300'
              : direction === 'got'
                ? 'mt-1 text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-300'
                : 'mt-1 text-base font-semibold tabular-nums text-slate-600 dark:text-slate-300'}>
              {isAdjustment ? (
                <span className="inline-flex items-center gap-1">
                  <Sliders size={13} />
                  <MoneySigned
                    amountMinor={entryToSignedAmount(entry)}
                    currency={currency}
                    hide={hideAmounts}
                  />
                </span>
              ) : (
                <Money
                  value={{ amountMinor: Math.abs(entry.amountMinor), currency }}
                  hide={hideAmounts}
                  emphasize
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={async () => {
          try {
            await lendEntryRepository.softDelete(entry.id);
            toast.show('Entry deleted', {
              action: {
                label: 'Undo',
                onClick: async () => {
                  await lendEntryRepository.restore(entry.id);
                },
              },
            });
          } catch (err) {
            toast.show(err instanceof Error ? err.message : 'Could not delete entry', {
              variant: 'error',
            });
          }
        }}
        aria-label="Delete entry"
        className="grid w-11 shrink-0 place-items-center border-l border-slate-900/[0.05] text-slate-300 transition-colors hover:bg-rose-500/[0.06] hover:text-rose-600 dark:border-white/[0.06] dark:text-slate-600 dark:hover:text-rose-300"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
