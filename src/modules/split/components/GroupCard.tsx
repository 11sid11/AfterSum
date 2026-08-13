import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { Money, MoneySigned } from '@components/ui';
import { ChevronRight } from 'lucide-react';
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
      className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{group.name}</div>
        <div className="mt-0.5 text-xs text-slate-500">{expenseCount} expense{expenseCount === 1 ? '' : 's'}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs text-slate-500">{label}</div>
        <div className={clsx('max-w-32 truncate text-sm font-semibold tabular-nums', yourNet > 0 && 'text-emerald-600', yourNet < 0 && 'text-rose-600')}>
          {yourNet === 0 ? <Money value={{ amountMinor: 0, currency: group.currency }} hide={hide} /> : <MoneySigned amountMinor={yourNet} currency={group.currency} hide={hide} />}
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-slate-400" />
    </Link>
  );
}
