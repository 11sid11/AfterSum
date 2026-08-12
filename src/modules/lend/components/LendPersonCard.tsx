/**
 * LendPersonCard — a row on the Lend dashboard listing a
 * person with their net balance and a "Owes you / You owe
 * / Settled" label.
 *
 * The label is rendered as TEXT (not color alone) per the
 * accessibility rules in work.md §81.
 */

import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { Money, BalanceText } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import type { PersonSummary } from '../domain/balance';

export function LendPersonCard({ summary }: { summary: PersonSummary }) {
  const settings = useAppSettings();
  const hide = !!settings?.hideAmounts;
  const { person, balanceMinor, currency, ledgers } = summary;
  const ledgerCount = ledgers.length;
  const label = balanceMinor > 0 ? 'Owes you' : balanceMinor < 0 ? 'You owe' : 'Settled';

  return (
    <Link
      to="/lend/person/$personId"
      params={{ personId: person.id }}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700 dark:hover:bg-brand-900/20"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        {person.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{person.name}</p>
        <p className="text-xs text-slate-500">
          {ledgerCount > 1 ? `${ledgerCount} ledgers` : '1 ledger'} · {currency}
        </p>
        <div className="mt-0.5">
          <BalanceText amountMinor={balanceMinor}>
            <Money
              value={{ amountMinor: Math.abs(balanceMinor), currency }}
              hide={hide}
              emphasize
            />
          </BalanceText>
        </div>
      </div>
      <div className="ml-auto flex flex-col items-end gap-0.5">
        <span
          className="text-xs font-medium text-slate-400"
          aria-label={`Status ${label}`}
        >
          {label}
        </span>
        <ChevronRight size={16} className="text-slate-300" />
      </div>
    </Link>
  );
}
