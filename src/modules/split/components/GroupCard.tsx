import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { Money } from '@components/ui';
import { Check, ChevronRight, Users } from 'lucide-react';
import type { SplitGroup } from '@db/schema';
import { useAppSettings } from '@shared/settings/useSettings';

interface GroupCardProps {
  group: SplitGroup;
  yourNet: number;
  expenseCount: number;
}

export function GroupCard({ group, yourNet, expenseCount }: GroupCardProps) {
  const settings = useAppSettings();
  const hide = settings?.hideAmounts ?? false;
  const label = yourNet > 0 ? "You're owed" : yourNet < 0 ? 'You owe' : 'Settled';
  const initial = group.name.trim().charAt(0).toLocaleUpperCase() || 'T';

  return (
    <Link
      to="/split/group/$groupId"
      params={{ groupId: group.id }}
      className="group block h-full rounded-[18px] border border-slate-200/[0.85] bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.025),0_5px_16px_rgb(15_23_42/0.035)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_8px_22px_rgb(15_23_42/0.06)] active:scale-[0.99] dark:border-white/[0.075] dark:bg-[#141821] dark:shadow-none dark:hover:border-white/[0.12]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-400/[0.13] dark:text-brand-200">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">{group.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500"><Users size={12} /> {expenseCount} expense{expenseCount === 1 ? '' : 's'} · {group.currency}</p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-slate-600" />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-200/75 pt-3.5 dark:border-white/[0.07]">
        <div>
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Activity</p>
          <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{expenseCount === 0 ? 'No expenses yet' : `${expenseCount} recorded`}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {yourNet === 0 && <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-300"><Check size={10} strokeWidth={2.8} /></span>}
            <p className={clsx('text-[10px] font-medium', yourNet > 0 && 'text-brand-600 dark:text-brand-300', yourNet < 0 && 'text-rose-600 dark:text-rose-300', yourNet === 0 && 'text-slate-500')}>{label}</p>
          </div>
          <p className={clsx('mt-1 max-w-32 truncate text-sm font-semibold tabular-nums', yourNet > 0 && 'text-brand-700 dark:text-brand-200', yourNet < 0 && 'text-rose-700 dark:text-rose-300', yourNet === 0 && 'text-slate-500 dark:text-slate-400')}>
            <Money value={{ amountMinor: Math.abs(yourNet), currency: group.currency }} hide={hide} />
          </p>
        </div>
      </div>
    </Link>
  );
}
