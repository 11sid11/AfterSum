/**
 * Overview dashboard component.
 */

import { Link } from '@tanstack/react-router';
import { Card, Money, MoneySigned, EmptyState, Spinner } from '@components/ui';
import { useOverviewSummary, useGlobalActivity } from '../queries';
import { toMonthKey, fromMonthKey, formatHumanDate } from '@shared/dates';
import { Receipt, Users, HandCoins, TrendingUp, ChevronRight } from 'lucide-react';
import type { ActivityItem } from '../projections/types';

export function OverviewDashboard({ month = toMonthKey() }: { month?: string }) {
  const summary = useOverviewSummary(month);
  const activity = useGlobalActivity(8);
  if (!summary) return <Spinner />;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{monthHeading(month)}</h1>
      </header>

      <Card>
        <Link to="/track" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="text-brand-600" size={20} />
            <div>
              <p className="text-sm font-semibold">Track</p>
              <p className="text-xs text-slate-500">Personal spending</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm">
              Spent{' '}
              <Money
                value={{ amountMinor: summary.track.spentMinor, currency: summary.track.currency }}
                emphasize
              />
            </p>
            {summary.track.budgetMinor !== undefined && (
              <p className="text-xs text-slate-500">
                Budget{' '}
                <Money
                  value={{ amountMinor: summary.track.budgetMinor, currency: summary.track.currency }}
                />
                {summary.track.budgetRemainingMinor !== undefined && (
                  <> · {summary.track.budgetRemainingMinor >= 0 ? 'Left' : 'Over by'}{' '}
                    <Money
                      value={{
                        amountMinor: Math.abs(summary.track.budgetRemainingMinor),
                        currency: summary.track.currency,
                      }}
                    />
                  </>
                )}
              </p>
            )}
            <ChevronRight size={16} className="ml-auto text-slate-400" />
          </div>
        </Link>
      </Card>

      <Card>
        <Link to="/split" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="text-brand-600" size={20} />
            <div>
              <p className="text-sm font-semibold">Split</p>
              <p className="text-xs text-slate-500">Trips & groups</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p>
              You're owed{' '}
              <Money
                value={{ amountMinor: summary.split.youAreOwedMinor, currency: summary.split.currency }}
                emphasize
              />
            </p>
            {summary.split.youOweMinor > 0 && (
              <p className="text-xs text-rose-600">
                You owe <Money value={{ amountMinor: summary.split.youOweMinor, currency: summary.split.currency }} />
              </p>
            )}
            <ChevronRight size={16} className="ml-auto text-slate-400" />
          </div>
        </Link>
      </Card>

      <Card>
        <Link to="/lend" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HandCoins className="text-brand-600" size={20} />
            <div>
              <p className="text-sm font-semibold">Lend</p>
              <p className="text-xs text-slate-500">Personal lending</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p>
              You're owed{' '}
              <Money
                value={{ amountMinor: summary.lend.youWillReceiveMinor, currency: summary.lend.currency }}
                emphasize
              />
            </p>
            {summary.lend.youOweMinor > 0 && (
              <p className="text-xs text-rose-600">
                You owe <Money value={{ amountMinor: summary.lend.youOweMinor, currency: summary.lend.currency }} />
              </p>
            )}
            <ChevronRight size={16} className="ml-auto text-slate-400" />
          </div>
        </Link>
      </Card>

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
                <ActivityRow key={a.id} item={a} />
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const icon = item.module === 'track' ? <Receipt size={16} /> : item.module === 'split' ? <Users size={16} /> : <HandCoins size={16} />;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="text-slate-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-slate-500">
          {capitalize(item.module)}
          {item.context ? ` · ${item.context}` : ''} · {formatHumanDate(item.date)}
        </p>
      </div>
      <div className="text-sm">
        <MoneySigned amountMinor={item.amountMinor} currency={item.currency} />
      </div>
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
