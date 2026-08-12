/**
 * TransactionListItem — single row in a transaction list.
 *
 * Renders icon, title, category, date, and amount. Clicking
 * the row navigates to the transaction's detail page.
 */

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
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
    >
      <div
        className={
          isExpense
            ? 'grid h-9 w-9 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
            : 'grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
        }
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{transaction.title}</p>
        <p className="truncate text-xs text-slate-500">
          {categoryName} · {formatHumanDate(transaction.date)}
          {transaction.paymentMethod ? ` · ${transaction.paymentMethod.toUpperCase()}` : ''}
        </p>
      </div>
      <div
        className={
          isExpense
            ? 'text-sm font-semibold text-rose-600 dark:text-rose-300'
            : 'text-sm font-semibold text-emerald-600 dark:text-emerald-300'
        }
      >
        <Money
          value={{ amountMinor: transaction.amountMinor, currency: transaction.currency }}
          hide={hide}
          signed
        />
      </div>
    </Link>
  );
}
