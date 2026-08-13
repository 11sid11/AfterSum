/**
 * Overview dashboard component.
 *
 * Track is month-scoped; Split and Lend are outstanding
 * balances. Activity amounts are intentionally unsigned because
 * each module has different accounting sign semantics.
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
        <p className="section-title mb-2">Track · {monthHeading(month)}</p>
        <Card>
          <Link to="/track" className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Receipt className="text-brand-600" size={20} />
              <div>
                <p className="text-sm font-semibold">Personal spending</p>
                <p className="text-xs text-slate-500">This month</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm">
                Spent{' '}
                <Money value={{ amountMinor: summary.track.spentMinor, currency: summary.track.currency }} hide={hide} emphasize />
              </p>
              {summary.track.budgetMinor !== undefined && (
                <p className="text-xs text-slate-500">
                  {summary.track.budgetRemainingMinor !== undefined && summary.track.budgetRemainingMinor < 0 ? 'Over by' : 'Left'}{' '}
                  <Money
                    value={{
                      amountMinor: Math.abs(summary.track.budgetRemainingMinor ?? 0),
                      currency: summary.track.currency,
                    }}
                    hide={hide}
                  />
                </p>
              )}
              <ChevronRight size={16} className="ml-auto text-slate-400" />
            </div>
          </Link>
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
