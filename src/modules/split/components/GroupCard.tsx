import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { Money, MoneySigned } from '@components/ui';
import { ChevronRight, Users } from 'lucide-react';
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

  return (
    <Link
      to="/split/group/$groupId"
      params={{ groupId: group.id }}
      className="group flex min-w-0 items-center gap-3 rounded-[22px] border border-slate-200/80 bg-white/95 p-3.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-slate-700"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
        <Users size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">{group.name}</p>
        <p className="mt-0.5 text-xs text-slate-500">{expenseCount} expense{expenseCount === 1 ? '' : 's'} · {group.currency}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className={clsx('max-w-32 truncate text-sm font-semibold tabular-nums', yourNet > 0 && 'text-emerald-600 dark:text-emerald-300', yourNet < 0 && 'text-rose-600 dark:text-rose-300')}>
          {yourNet === 0 ? <Money value={{ amountMinor: 0, currency: group.currency }} hide={hide} /> : <MoneySigned amountMinor={yourNet} currency={group.currency} hide={hide} />}
        </p>
      </div>
      <ChevronRight size={17} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
