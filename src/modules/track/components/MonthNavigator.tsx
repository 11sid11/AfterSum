/**
 * MonthNavigator — month label + previous/next arrows.
 *
 * Renders three buttons: prev, the current month label,
 * and next. Disabling "next" when the month is the current
 * calendar month is optional and controlled by the caller.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { shiftMonth } from '@shared/dates';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTH_LABELS[(m ?? 1) - 1] ?? '';
  return `${name} ${y}`;
}

interface MonthNavigatorProps {
  month: string; // YYYY-MM
  /** Where the prev/next buttons should route. */
  to?: string; // route base
  /** Optional: disable "next" when on current month. */
  disableNextIfCurrent?: boolean;
  /** Current month to compare against. */
  currentMonth?: string;
  /** Optional search-params passthrough. */
  search?: Record<string, unknown>;
}

export function MonthNavigator({
  month,
  to = '/track/month/$year/$month',
  disableNextIfCurrent = false,
  currentMonth,
  search,
}: MonthNavigatorProps) {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const nextDisabled = disableNextIfCurrent && currentMonth ? next > currentMonth : false;
  const [year, m] = month.split('-');
  const [prevYear, prevM] = prev.split('-');
  const [nextYear, nextM] = next.split('-');
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        to={to}
        params={{ year: prevYear ?? '', month: prevM ?? '' }}
        search={search}
        aria-label="Previous month"
        className="grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <ChevronLeft size={20} />
      </Link>
      <div className="text-base font-semibold tracking-wide" data-testid="month-label">
        {formatMonth(month)}
      </div>
      <Link
        to={to}
        params={{ year: nextYear ?? '', month: nextM ?? '' }}
        search={search}
        aria-label="Next month"
        aria-disabled={nextDisabled}
        tabIndex={nextDisabled ? -1 : 0}
        className={
          nextDisabled
            ? 'pointer-events-none grid h-10 w-10 place-items-center rounded-full text-slate-300 dark:text-slate-700'
            : 'grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }
      >
        <ChevronRight size={20} />
      </Link>
      {/* hidden params for the current month (used by callers to navigate programmatically) */}
      <span className="sr-only" data-year={year} data-month={m} />
    </div>
  );
}
