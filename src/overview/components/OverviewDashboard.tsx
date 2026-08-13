/**
 * Overview dashboard component.
 *
 * Personal spending is a read-only projection of Track expenses plus the
 * current user's Split shares for the selected month. Split and Lend
 * outstanding balances remain independent.
 */

import { Link } from '@tanstack/react-router';
import { Card, Money, EmptyState, Spinner } from '@components/ui';
import { useOverviewSummary, useGlobalActivity } from '../queries';
import { toMonthKey, fromMonthKey, formatHumanDate } from '@shared/dates';
import { Receipt, Users, HandCoins, TrendingUp, ChevronRight } from 'lucide-react';
import { useAppSettings } from '@shared/settings/useSettings';
import type { ActivityItem } from '../projections/types';

export function OverviewDashboard({ month = toMonthKey() }: { month?: string }) {
  const summary = useOverviewSummary(month);
  const activity = useGlobalActivity(8);
  const settings = useAppSettings();
  if (!summary || !settings) return <Spinner />;
  const hide = settings.hideAmounts;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold">Overview</h1>
        <p className="mt-0.5 text-xs text-slate-500">Your finances, without mixing the underlying records.</p>
      </header>

      <section>
        <p className="section-title mb-2">Personal spending · {monthHeading(month)}</p>
        <Card padded={false}>
          <div className="px-4 py-4">
            <p className="text-xs text-slate-500">Your economic spending this month</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              <Money
                value={{
                  amountMinor: summary.personalSpending.totalMinor,
                  currency: summary.personalSpending.currency,
                }}
                hide={hide}
                emphasize
              />
            </p>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800">
            <Link
              to="/track"
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <Receipt className="text-brand-600" size={18} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Track</p>
                <p className="text-xs text-slate-500">Expenses you logged directly</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  <Money
                    value={{ amountMinor: summary.personalSpending.trackMinor, currency: summary.personalSpending.currency }}
                    hide={hide}
                  />
                </p>
                {summary.track.budgetMinor !== undefined && (
                  <p className="text-xs text-slate-500">
                    Track budget {summary.track.budgetRemainingMinor !== undefined && summary.track.budgetRemainingMinor < 0 ? 'over by' : 'left'}{' '}
                    <Money
                      value={{
                        amountMinor: Math.abs(summary.track.budgetRemainingMinor ?? 0),
                        currency: summary.track.currency,
                      }}
                      hide={hide}
                    />
                  </p>
                )}
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </Link>

            <Link
              to="/split"
              className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
            >
              <Users className="text-brand-600" size={18} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Trip shares</p>
                <p className="text-xs text-slate-500">Your share of Split expenses</p>
              </div>
              <p className="text-sm font-semibold tabular-nums">
                <Money
                  value={{ amountMinor: summary.personalSpending.splitShareMinor, currency: summary.personalSpending.currency }}
                  hide={hide}
                />
              </p>
              <ChevronRight size={16} className="text-slate-400" />
            </Link>
          </div>
        </Card>
      </section>

      <section>
        <p className="section-title mb-2">Split · Outstanding</p>
        <Card>
          <Link to="/split" className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Users className="text-brand-600" size={20} />
              <div>
                <p className="text-sm font-semibold">Trips & groups</p>
                <p className="text-xs text-slate-500">Current unsettled position</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p>
                You get back{' '}
                <Money value={{ amountMinor: summary.split.youAreOwedMinor, currency: summary.split.currency }} hide={hide} emphasize />
              </p>
              {summary.split.youOweMinor > 0 && (
                <p className="text-xs text-rose-600">
                  You owe <Money value={{ amountMinor: summary.split.youOweMinor, currency: summary.split.currency }} hide={hide} />
                </p>
              )}
              <ChevronRight size={16} className="ml-auto text-slate-400" />
            </div>
          </Link>
        </Card>
      </section>

      <section>
        <p className="section-title mb-2">Lend · Outstanding</p>
        <Card>
          <Link to="/lend" className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <HandCoins className="text-brand-600" size={20} />
              <div>
                <p className="text-sm font-semibold">Personal lending</p>
                <p className="text-xs text-slate-500">Current outstanding position</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p>
                You'll receive{' '}
                <Money value={{ amountMinor: summary.lend.youWillReceiveMinor, currency: summary.lend.currency }} hide={hide} emphasize />
              </p>
              {summary.lend.youOweMinor > 0 && (
                <p className="text-xs text-rose-600">
                  You owe <Money value={{ amountMinor: summary.lend.youOweMinor, currency: summary.lend.currency }} hide={hide} />
                </p>
              )}
              <ChevronRight size={16} className="ml-auto text-slate-400" />
            </div>
          </Link>
        </Card>
      </section>

      <section>
        <h2 className="section-title mb-2">Recent activity</h2>
        {activity === undefined ? (
          <Spinner />
        ) : activity.length === 0 ? (
          <Card>
            <EmptyState
              title="Your overview will appear as you use Track, Split and Lend."
              icon={<TrendingUp size={32} />}
            />
          </Card>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {activity.map((a) => (
                <ActivityRow key={a.id} item={a} hide={hide} />
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
      <Link to={destination} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <div className="text-slate-400">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="text-xs text-slate-500">
            {capitalize(item.module)}
            {item.context ? ` · ${item.context}` : ''} · {formatHumanDate(item.date)}
          </p>
        </div>
        <div className="text-sm font-medium">
          <Money value={{ amountMinor: Math.abs(item.amountMinor), currency: item.currency }} hide={hide} />
        </div>
      </Link>
    </li>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function monthHeading(month: string): string {
  const d = fromMonthKey(month);
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}
