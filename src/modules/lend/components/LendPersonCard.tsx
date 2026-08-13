import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { Money, BalanceText } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import type { PersonSummary } from '../domain/balance';

export function LendPersonCard({ summary }: { summary: PersonSummary }) {
  const settings = useAppSettings();
  const hide = !!settings?.hideAmounts;
  const { person, balanceMinor, currency, ledgers } = summary;
  const label = balanceMinor > 0 ? 'Owes you' : balanceMinor < 0 ? 'You owe' : 'Settled';
  const context = ledgers.length > 1 ? `${ledgers.length} currency balances` : currency;

  return (
    <Link
      to="/lend/person/$personId"
      params={{ personId: person.id }}
      className="group flex min-w-0 items-center gap-3 rounded-[22px] border border-slate-200/80 bg-white/95 p-3.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-slate-700"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-sm font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-200">
        {person.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">{person.name}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{context}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-medium text-slate-400" aria-label={`Status ${label}`}>{label}</p>
        <div className="mt-0.5 text-sm font-semibold tabular-nums">
          <BalanceText amountMinor={balanceMinor}>
            <Money value={{ amountMinor: Math.abs(balanceMinor), currency }} hide={hide} emphasize />
          </BalanceText>
        </div>
      </div>
      <ChevronRight size={17} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
