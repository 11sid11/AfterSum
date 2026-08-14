import { Link } from '@tanstack/react-router';
import { Check, ChevronRight } from 'lucide-react';
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
      className="group surface-lift flex min-w-0 items-center gap-3 rounded-[24px] border border-slate-900/[0.06] bg-white/[0.94] p-3.5 shadow-soft-sm backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.045] dark:shadow-none"
    >
      <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[17px] bg-emerald-950 text-sm font-semibold text-emerald-100 shadow-soft-xs dark:bg-emerald-300 dark:text-emerald-950">
        <span className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-emerald-400/25 blur-md" aria-hidden="true" />
        <span className="relative">{person.name.slice(0, 1).toUpperCase()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">{person.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{context}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {balanceMinor === 0 && <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-300"><Check size={10} strokeWidth={2.8} /></span>}
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400" aria-label={`Status ${label}`}>{label}</p>
        </div>
        <div className="mt-0.5 text-sm font-semibold tabular-nums">
          <BalanceText amountMinor={balanceMinor}>
            <Money value={{ amountMinor: Math.abs(balanceMinor), currency }} hide={hide} emphasize />
          </BalanceText>
        </div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-slate-600" />
    </Link>
  );
}
