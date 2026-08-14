import { Link } from '@tanstack/react-router';
import { Check, ChevronRight } from 'lucide-react';
import { Money } from '@components/ui';
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
      className="group flex min-w-0 items-center gap-3 rounded-[16px] border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.025),0_4px_12px_rgb(15_23_42/0.025)] transition-[transform,border-color,background-color] duration-200 hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50/60 active:scale-[0.99] dark:border-white/[0.075] dark:bg-[#141821] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.05]"
    >
      <div className={balanceMinor < 0
        ? 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-100 text-xs font-semibold text-rose-700 dark:bg-rose-400/[0.11] dark:text-rose-300'
        : 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/[0.11] dark:text-emerald-300'}>
        {person.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-[-0.015em]">{person.name}</p>
        <p className={balanceMinor > 0
          ? 'mt-0.5 truncate text-[11px] text-emerald-700 dark:text-emerald-300'
          : balanceMinor < 0
            ? 'mt-0.5 truncate text-[11px] text-rose-700 dark:text-rose-300'
            : 'mt-0.5 truncate text-[11px] text-slate-500'}>
          {label} · {context}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <div className={balanceMinor > 0
          ? 'text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300'
          : balanceMinor < 0
            ? 'text-sm font-semibold tabular-nums text-rose-700 dark:text-rose-300'
            : 'text-sm font-semibold tabular-nums text-slate-500'}>
          <Money value={{ amountMinor: Math.abs(balanceMinor), currency }} hide={hide} emphasize />
        </div>
        {balanceMinor === 0 && <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400"><Check size={10} /> settled</span>}
      </div>
      <ChevronRight size={15} className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-slate-600" />
    </Link>
  );
}
