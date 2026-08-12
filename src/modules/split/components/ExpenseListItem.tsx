/**
 * ExpenseListItem.
 *
 * Row in a group's expense list. Shows the title, date,
 * total amount, and a compact "X paid, Y owe" summary
 * when names are available.
 */

import { Link } from '@tanstack/react-router';
import { Money } from '@components/ui';
import type { SplitExpense } from '@db/schema';
import { formatHumanDate } from '@shared/dates';

interface ExpenseListItemProps {
  expense: SplitExpense;
  payerNames?: string[];
  participantNames?: string[];
  selfPersonId?: string;
}

export function ExpenseListItem({ expense, payerNames, participantNames }: ExpenseListItemProps) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex-1">
        <div className="text-sm font-medium">{expense.title}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {formatHumanDate(expense.date)}
          {payerNames && payerNames.length > 0 && (
            <>
              {' · '}
              <span>paid by {payerNames.join(', ')}</span>
            </>
          )}
          {participantNames && participantNames.length > 0 && (
            <>
              {' · '}
              <span>split among {participantNames.length}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right text-sm font-semibold tabular-nums">
        <Money value={{ amountMinor: expense.amountMinor, currency: expense.currency }} />
      </div>
      <Link
        to="/split/group/$groupId/add"
        params={{ groupId: expense.groupId }}
        search={{ type: 'expense', editId: expense.id }}
        className="sr-only"
        aria-label={`Edit ${expense.title}`}
      >
        Edit
      </Link>
    </li>
  );
}
