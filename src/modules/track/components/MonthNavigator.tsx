/** Month label with previous/next navigation. */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { shiftMonth } from '@shared/dates';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const name = MONTH_LABELS[(monthNumber ?? 1) - 1] ?? '';
  return `${name} ${year}`;
}

interface MonthNavigatorProps {
  month: string;
  to?: string;
  disableNextIfCurrent?: boolean;
  currentMonth?: string;
  search?: Record<string, unknown>;
}

export function MonthNavigator({ month, to = '/track/month/$year/$month', disableNextIfCurrent = false, currentMonth, search }: MonthNavigatorProps) {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const nextDisabled = disableNextIfCurrent && currentMonth ? next > currentMonth : false;
  const [year, currentMonthNumber] = month.split('-');
  const [prevYear, prevMonth] = prev.split('-');
  const [nextYear, nextMonth] = next.split('-');

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/75 p-1.5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/75">
      <Link to={to} params={{ year: prevYear ?? '', month: prevMonth ?? '' }} search={search} aria-label="Previous month" className="icon-button border-0 hover:bg-slate-100 dark:hover:bg-slate-800">
        <ChevronLeft size={19} />
      </Link>
      <div className="min-w-0 flex-1 text-center text-sm font-semibold tracking-tight sm:text-base" data-testid="month-label">{formatMonth(month)}</div>
      <Link
        to={to}
        params={{ year: nextYear ?? '', month: nextMonth ?? '' }}
        search={search}
        aria-label="Next month"
        aria-disabled={nextDisabled}
        tabIndex={nextDisabled ? -1 : 0}
        className={nextDisabled ? 'pointer-events-none grid h-10 w-10 place-items-center rounded-xl text-slate-300 dark:text-slate-700' : 'icon-button border-0 hover:bg-slate-100 dark:hover:bg-slate-800'}
      >
        <ChevronRight size={19} />
      </Link>
      <span className="sr-only" data-year={year} data-month={currentMonthNumber} />
    </div>
  );
}
