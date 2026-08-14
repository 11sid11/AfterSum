import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { Money, MoneySigned } from '@components/ui';
import { Check, ChevronRight } from 'lucide-react';
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
      className="group surface-lift flex min-w-0 items-center gap-3 rounded-[24px] border border-slate-900/[0.06] bg-white/94 p-3.5 shadow-soft-sm backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.045] dark:shadow-none"
    >
      <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[17px] bg-[#1b1830] text-base font-semibold text-white shadow-soft-xs dark:bg-brand-300 dark:text-brand-950">
        <span className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-brand-400/40 blur-md" aria-hidden="true" />
        <span className="relative">{initial}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">{group.name}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{expenseCount} expense{expenseCount === 1 ? '' : 's'} · {group.currency}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {yourNet === 0 && <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"><Check size={10} strokeWidth={2.8} /></span>}
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
        </div>
        <p className={clsx('mt-0.5 max-w-32 truncate text-sm font-semibold tabular-nums', yourNet > 0 && 'text-emerald-600 dark:text-emerald-300', yourNet < 0 && 'text-rose-600 dark:text-rose-300', yourNet === 0 && 'text-slate-500 dark:text-slate-400')}>
          {yourNet === 0 ? <Money value={{ amountMinor: 0, currency: group.currency }} hide={hide} /> : <MoneySigned amountMinor={yourNet} currency={group.currency} hide={hide} />}
        </p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-slate-600" />
    </Link>
  );
}
