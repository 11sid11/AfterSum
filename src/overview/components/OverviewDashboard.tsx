/** Read-only overview across Track, Split and Lend. */

import { Link } from '@tanstack/react-router';
import { Card, Money, EmptyState, Spinner } from '@components/ui';
import { useOverviewSummary, useGlobalActivity } from '../queries';
import { toMonthKey, fromMonthKey, formatHumanDate } from '@shared/dates';
import { Receipt, Users, HandCoins, TrendingUp, ChevronRight, WalletCards } from 'lucide-react';
import { useAppSettings } from '@shared/settings/useSettings';
import type { ActivityItem } from '../projections/types';

export function OverviewDashboard({ month = toMonthKey() }: { month?: string }) {
  const summary = useOverviewSummary(month);
  const activity = useGlobalActivity(8);
  const settings = useAppSettings();
  if (!summary || !settings) return <Spinner />;
  const hide = settings.hideAmounts;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Overview</h1>
        <p className="page-subtitle">A clear view across Track, Split and Lend without mixing their records.</p>
      </header>

      <Card padded={false} className="overflow-hidden bg-gradient-to-br from-white via-white to-brand-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/30">
        <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Personal spending</p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{monthHeading(month)}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-600/20">
              <WalletCards size={18} />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.035em] tabular-nums sm:text-4xl">
            <Money
              value={{ amountMinor: summary.personalSpending.totalMinor, currency: summary.personalSpending.currency }}
              hide={hide}
              emphasize
            />
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Track expenses plus your share of Split expenses.</p>
        </div>

        <div className="grid border-t border-slate-200/70 bg-white/55 dark:border-slate-800 dark:bg-slate-950/20 sm:grid-cols-2">
          <Link to="/track" className="group flex min-w-0 items-center gap-3 px-5 py-4 transition-colors hover:bg-white/80 dark:hover:bg-slate-800/55 sm:border-r sm:border-slate-200/70 sm:dark:border-slate-800">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Receipt size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">Track</p>
              <p className="truncate text-sm font-semibold tabular-nums">
                <Money value={{ amountMinor: summary.personalSpending.trackMinor, currency: summary.personalSpending.currency }} hide={hide} />
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link to="/split" className="group flex min-w-0 items-center gap-3 border-t border-slate-200/70 px-5 py-4 transition-colors hover:bg-white/80 dark:border-slate-800 dark:hover:bg-slate-800/55 sm:border-t-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Users size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">Trip shares</p>
              <p className="truncate text-sm font-semibold tabular-nums">
                <Money value={{ amountMinor: summary.personalSpending.splitShareMinor, currency: summary.personalSpending.currency }} hide={hide} />
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Card>

      <section>
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="section-title">Outstanding</h2>
          <span className="text-[11px] text-slate-400">Current position</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/split" className="group block">
            <Card className="h-full transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
                  <Users size={18} />
                </div>
                <ChevronRight size={17} className="text-slate-300 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-4 text-sm font-semibold">Split</p>
              <p className="mt-0.5 text-xs text-slate-500">Trips and shared expenses</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] text-slate-400">You get back</p>
                  <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
                    <Money value={{ amountMinor: summary.split.youAreOwedMinor, currency: summary.split.currency }} hide={hide} emphasize />
                  </p>
                </div>
                {summary.split.youOweMinor > 0 && (
                  <div className="text-right">
                    <p className="text-[11px] text-slate-400">You owe</p>
                    <p className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-300">
                      <Money value={{ amountMinor: summary.split.youOweMinor, currency: summary.split.currency }} hide={hide} />
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </Link>

          <Link to="/lend" className="group block">
            <Card className="h-full transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
                  <HandCoins size={18} />
                </div>
                <ChevronRight size={17} className="text-slate-300 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-4 text-sm font-semibold">Lend</p>
              <p className="mt-0.5 text-xs text-slate-500">Direct money with people</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] text-slate-400">You'll receive</p>
                  <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
                    <Money value={{ amountMinor: summary.lend.youWillReceiveMinor, currency: summary.lend.currency }} hide={hide} emphasize />
                  </p>
                </div>
                {summary.lend.youOweMinor > 0 && (
                  <div className="text-right">
                    <p className="text-[11px] text-slate-400">You owe</p>
                    <p className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-300">
                      <Money value={{ amountMinor: summary.lend.youOweMinor, currency: summary.lend.currency }} hide={hide} />
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="section-title mb-2.5">Recent activity</h2>
        {activity === undefined ? (
          <Spinner />
        ) : activity.length === 0 ? (
          <Card>
            <EmptyState title="Your overview will appear as you use Track, Split and Lend." icon={<TrendingUp size={26} />} />
          </Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {activity.map((item) => (
                <ActivityRow key={item.id} item={item} hide={hide} />
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function ActivityRow({ item, hide }: { item: ActivityItem; hide: boolean }) {
  const icon = item.module === 'track' ? <Receipt size={16} /> : item.module === 'split' ? <Users size={16} /> : <HandCoins size={16} />;
  const destination = item.module === 'track' ? `/track/transaction/${item.sourceEntityId}` : item.module === 'split' ? '/split' : '/lend';
  return (
    <li>
      <Link to={destination} className="group flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/45 sm:px-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
          <p className="truncate text-xs text-slate-500">
            {capitalize(item.module)}{item.context ? ` · ${item.context}` : ''} · {formatHumanDate(item.date)}
          </p>
        </div>
        <div className="shrink-0 text-sm font-semibold tabular-nums">
          <Money value={{ amountMinor: Math.abs(item.amountMinor), currency: item.currency }} hide={hide} />
        </div>
      </Link>
    </li>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function monthHeading(month: string): string {
  const date = fromMonthKey(month);
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}
