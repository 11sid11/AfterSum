/** Single row in a Track transaction list. */

import { Link } from '@tanstack/react-router';
import { ArrowDownLeft, ArrowUpRight, ShoppingBag, type LucideIcon } from 'lucide-react';
import { Money } from '@components/ui';
import { formatHumanDate } from '@shared/dates';
import { useAppSettings } from '@shared/settings/useSettings';
import type { TrackTransactionWithCategory } from '../domain/types';

const ICON_MAP: Record<string, LucideIcon> = {
  utensils: ShoppingBag,
  plane: ShoppingBag,
  'shopping-bag': ShoppingBag,
  receipt: ShoppingBag,
  film: ShoppingBag,
  heart: ShoppingBag,
  book: ShoppingBag,
  circle: ShoppingBag,
  'trending-up': ShoppingBag,
};

interface TransactionListItemProps {
  transaction: TrackTransactionWithCategory;
  to?: string;
}

export function TransactionListItem({ transaction, to = '/track/transaction/$transactionId' }: TransactionListItemProps) {
  const settings = useAppSettings();
  const hide = settings?.hideAmounts ?? false;
  const isExpense = transaction.type === 'expense';
  const iconName = transaction.category?.icon ?? 'circle';
  const Icon = ICON_MAP[iconName] ?? (isExpense ? ArrowUpRight : ArrowDownLeft);
  const categoryName = transaction.category?.name ?? 'Uncategorised';

  return (
    <Link
      to={to}
      params={{ transactionId: transaction.id }}
      className="interactive-row group flex min-w-0 items-center gap-3 px-4 py-3.5 dark:hover:bg-slate-800/[0.45] sm:px-5"
    >
      <div className={isExpense
        ? 'grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-rose-500/[0.08] text-rose-600 dark:text-rose-300'
        : 'grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300'}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium tracking-[-0.01em] text-slate-900 dark:text-slate-100">{transaction.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">
          {categoryName} · {formatHumanDate(transaction.date)}
          {transaction.paymentMethod ? ` · ${transaction.paymentMethod.toUpperCase()}` : ''}
        </p>
      </div>
      <div className={isExpense
        ? 'shrink-0 text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-300'
        : 'shrink-0 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-300'}>
        <Money value={{ amountMinor: transaction.amountMinor, currency: transaction.currency }} hide={hide} signed />
      </div>
    </Link>
  );
}
