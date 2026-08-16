/** Lend person detail page. */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Card, EmptyState, Money, Spinner } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { usePerson } from '@shared/people/queries';
import type { CurrencyCode } from '@shared/money';
import { useLendPersonDetail } from '@modules/lend/queries';
import { LendLedgerEntryRow } from '@modules/lend/components/LendLedgerEntryRow';
import { LendQuickEntryModal } from '@modules/lend/components/LendQuickEntryModal';
import {
  runningBalanceByEntryId,
  type LendQuickDirection,
} from '@modules/lend/domain/quickEntry';

interface LendQuickActionsProps {
  mobile?: boolean;
  onSelect: (direction: LendQuickDirection) => void;
}

function LendQuickActions({ mobile = false, onSelect }: LendQuickActionsProps) {
  return (
    <div
      className={
        mobile
          ? 'fixed inset-x-0 bottom-[calc(4.7rem+env(safe-area-inset-bottom))] z-20 px-4 sm:hidden'
          : 'hidden sm:block'
      }
    >
      <div
        className={
          mobile
            ? 'mx-auto grid max-w-md grid-cols-2 gap-2 rounded-[20px] border border-slate-900/[0.07] bg-white/[0.96] p-2 shadow-[0_-8px_28px_rgb(15_23_42/0.08)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#141821]/[0.96] dark:shadow-none'
            : 'grid grid-cols-2 gap-2'
        }
      >
        <button
          type="button"
          onClick={() => onSelect('gave')}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[15px] border border-rose-500/20 bg-rose-500/[0.08] px-4 text-sm font-semibold text-rose-700 transition-[transform,background-color] hover:bg-rose-500/[0.12] active:scale-[0.98] dark:text-rose-300"
        >
          <ArrowUpRight size={17} /> You gave
        </button>
        <button
          type="button"
          onClick={() => onSelect('got')}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[15px] border border-emerald-500/20 bg-emerald-500/[0.08] px-4 text-sm font-semibold text-emerald-700 transition-[transform,background-color] hover:bg-emerald-500/[0.12] active:scale-[0.98] dark:text-emerald-300"
        >
          <ArrowDownLeft size={17} /> You got
        </button>
      </div>
    </div>
  );
}

export function LendPersonPage() {
  const { personId } = useParams({ strict: false }) as { personId: string };
  const navigate = useNavigate();
  const person = usePerson(personId);
  const settings = useAppSettings();
  const detail = useLendPersonDetail(personId);
  const [quickDirection, setQuickDirection] = useState<LendQuickDirection | null>(null);

  if (!settings || !person || !detail) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  const hide = !!settings.hideAmounts;
  const { totalBalance, entries } = detail;
  const currency = (detail.currency ?? settings.defaultCurrency) as CurrencyCode;
  const runningBalances = runningBalanceByEntryId(entries);
  const balanceLabel =
    totalBalance > 0
      ? `${person.name} owes you`
      : totalBalance < 0
        ? `You owe ${person.name}`
        : 'Settled up';
  const handleQuickAction = (direction: LendQuickDirection) => setQuickDirection(direction);
  const mobileQuickActions =
    typeof document === 'undefined'
      ? null
      : createPortal(<LendQuickActions mobile onSelect={handleQuickAction} />, document.body);

  return (
    <div className="space-y-4 pb-20 sm:pb-0">
      <header className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: '/lend' })}
          aria-label="Back"
          className="icon-button shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500/[0.09] text-sm font-semibold text-brand-700 dark:text-brand-200">
          {person.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-[-0.025em]">{person.name}</h1>
          <p className="text-[11px] text-slate-500">Personal Lend ledger</p>
        </div>
      </header>

      <Card className={totalBalance > 0
        ? 'bg-gradient-to-b from-emerald-50/70 to-white dark:from-emerald-400/[0.055] dark:to-[#141821]'
        : totalBalance < 0
          ? 'bg-gradient-to-b from-rose-50/70 to-white dark:from-rose-400/[0.055] dark:to-[#141821]'
          : undefined}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-500">{balanceLabel}</p>
        <p className={totalBalance > 0
          ? 'mt-2 text-[2rem] font-semibold tracking-[-0.045em] text-emerald-700 dark:text-emerald-300'
          : totalBalance < 0
            ? 'mt-2 text-[2rem] font-semibold tracking-[-0.045em] text-rose-700 dark:text-rose-300'
            : 'mt-2 text-[2rem] font-semibold tracking-[-0.045em] text-slate-500'}>
          <Money
            value={{ amountMinor: Math.abs(totalBalance), currency }}
            hide={hide}
            emphasize
          />
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Use the two buttons below like a simple cash ledger. AfterSum handles lending, borrowing, and repayments underneath.
        </p>
      </Card>

      <LendQuickActions onSelect={handleQuickAction} />
      {mobileQuickActions}

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            title="No entries yet"
            description="Record the first amount with You gave or You got. The balance will update automatically."
          />
        </Card>
      ) : (
        <section>
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <h2 className="section-title">History</h2>
              <p className="mt-1 text-xs text-slate-500">Newest first · running balance is derived from history.</p>
            </div>
          </div>
          <ul className="space-y-2.5">
            {entries.map((entry) => (
              <li key={entry.id}>
                <LendLedgerEntryRow
                  entry={entry}
                  runningBalanceMinor={runningBalances[entry.id] ?? 0}
                  currency={currency}
                  hideAmounts={hide}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <LendQuickEntryModal
        open={quickDirection !== null}
        direction={quickDirection ?? 'gave'}
        person={person}
        currentBalanceMinor={totalBalance}
        currency={currency}
        hideAmounts={hide}
        onClose={() => setQuickDirection(null)}
      />
    </div>
  );
}
