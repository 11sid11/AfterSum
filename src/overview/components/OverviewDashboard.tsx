/** Read-only overview across Track, Split and Lend. */

import { Link } from '@tanstack/react-router';
import { Card, Money, EmptyState, Spinner } from '@components/ui';
import { useOverviewSummary, useGlobalActivity } from '../queries';
import { toMonthKey, fromMonthKey, formatHumanDate } from '@shared/dates';
import {
  ChevronRight,
  HandCoins,
  Receipt,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAppSettings } from '@shared/settings/useSettings';
import type { ActivityItem } from '../projections/types';

export function OverviewDashboard({ month = toMonthKey() }: { month?: string }) {
  const summary = useOverviewSummary(month);
  const activity = useGlobalActivity(8);
  const settings = useAppSettings();
  if (!summary || !settings) return <Spinner />;

  const hide = settings.hideAmounts;
  const spending = summary.personalSpending;
  const total = Math.max(0, spending.totalMinor);
  const trackPct = total > 0 ? Math.min(100, Math.max(0, (spending.trackMinor / total) * 100)) : 50;
  const splitPct = Math.max(0, 100 - trackPct);

  return (
    <div className="space-y-8">
      <section className="pt-1 sm:pt-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">
          {monthHeading(month)}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h1 className="text-[2.75rem] font-semibold leading-none tracking-[-0.055em] tabular-nums text-slate-950 dark:text-white sm:text-[3.55rem]">
            <Money value={{ amountMinor: spending.totalMinor, currency: spending.currency }} hide={hide} emphasize />
          </h1>
          <span className="text-xs text-slate-500">personal spending</span>
        </div>
        <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500 dark:text-slate-400">
          Your Track expenses plus your share of active Split expenses. Lend stays separate.
        </p>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.08]" aria-label="Personal spending breakdown">
          <div className="flex h-full w-full">
            <div className="h-full bg-[#a54431] transition-[width] duration-500" style={{ width: `${trackPct}%` }} />
            <div className="h-full bg-brand-600 transition-[width] duration-500 dark:bg-brand-400" style={{ width: `${splitPct}%` }} />
          </div>
        </div>

        <Card className="mt-3" padded={false}>
          <div className="grid grid-cols-2 divide-x divide-slate-200/80 dark:divide-white/[0.075]">
            <SpendingBreakdown
              to="/track"
              dotClass="bg-[#a54431]"
              label="Track"
              amount={<Money value={{ amountMinor: spending.trackMinor, currency: spending.currency }} hide={hide} />}
            />
            <SpendingBreakdown
              to="/split"
              dotClass="bg-brand-600 dark:bg-brand-400"
              label="Split"
              amount={<Money value={{ amountMinor: spending.splitShareMinor, currency: spending.currency }} hide={hide} />}
            />
          </div>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.02em]">Money in motion</h2>
            <p className="mt-1 text-xs text-slate-500">Outstanding balances, kept separate by module.</p>
          </div>
        </div>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
          <PositionCard
            to="/split"
            icon={<Users size={18} />}
            title="Split"
            description="Trips and shared expenses"
            receiveMinor={summary.split.youAreOwedMinor}
            oweMinor={summary.split.youOweMinor}
            currency={summary.split.currency}
            hide={hide}
            accent="brand"
          />
          <PositionCard
            to="/lend"
            icon={<HandCoins size={18} />}
            title="Lend"
            description="Direct money with people"
            receiveMinor={summary.lend.youWillReceiveMinor}
            oweMinor={summary.lend.youOweMinor}
            currency={summary.lend.currency}
            hide={hide}
            accent="emerald"
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.02em]">Recent activity</h2>
            <p className="mt-1 text-xs text-slate-500">A neutral timeline across Track, Split and Lend.</p>
          </div>
        </div>
        {activity === undefined ? (
          <Spinner />
        ) : activity.length === 0 ? (
          <Card>
            <EmptyState title="Your overview will appear as you use Track, Split and Lend." icon={<TrendingUp size={26} />} />
          </Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <ul className="stagger-list divide-y divide-slate-200/75 dark:divide-white/[0.07]">
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

function SpendingBreakdown({
  to,
  dotClass,
  label,
  amount,
}: {
  to: '/track' | '/split';
  dotClass: string;
  label: string;
  amount: React.ReactNode;
}) {
  return (
    <Link to={to} className="group flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.035] sm:px-5">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-slate-500">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{amount}</span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600" />
    </Link>
  );
}

function PositionCard({
  to,
  icon,
  title,
  description,
  receiveMinor,
  oweMinor,
  currency,
  hide,
  accent,
}: {
  to: '/split' | '/lend';
  icon: React.ReactNode;
  title: string;
  description: string;
  receiveMinor: number;
  oweMinor: number;
  currency: string;
  hide: boolean;
  accent: 'brand' | 'emerald';
}) {
  const accentClass = accent === 'brand'
    ? 'bg-brand-100 text-brand-700 dark:bg-brand-400/[0.14] dark:text-brand-200'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/[0.13] dark:text-emerald-200';

  return (
    <Link to={to} className="group min-w-[258px] snap-center sm:min-w-0">
      <Card className="h-full transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_8px_22px_rgb(15_23_42/0.055)] dark:hover:border-white/[0.11] dark:hover:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-full ${accentClass}`}>{icon}</div>
          <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-white/[0.055] dark:text-slate-400">
            {title}
          </span>
        </div>
        <p className="mt-4 text-xs text-slate-500">{description}</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-slate-500">To receive</p>
            <p className="mt-1 truncate text-[16px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              <Money value={{ amountMinor: receiveMinor, currency }} hide={hide} emphasize />
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500">You owe</p>
            <p className="mt-1 truncate text-[16px] font-semibold tabular-nums text-rose-700 dark:text-rose-300">
              <Money value={{ amountMinor: oweMinor, currency }} hide={hide} />
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3 text-[11px] text-slate-500 dark:border-white/[0.07]">
          <span>{receiveMinor === 0 && oweMinor === 0 ? 'All settled' : 'Open balances'}</span>
          <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
}

function ActivityRow({ item, hide }: { item: ActivityItem; hide: boolean }) {
  const icon = item.module === 'track' ? <Receipt size={15} /> : item.module === 'split' ? <Users size={15} /> : <HandCoins size={15} />;
  const destination = item.module === 'track' ? `/track/transaction/${item.sourceEntityId}` : item.module === 'split' ? '/split' : '/lend';
  const iconClass = item.module === 'track'
    ? 'bg-[#fff0eb] text-[#a54431] dark:bg-rose-400/[0.09] dark:text-rose-300'
    : item.module === 'split'
      ? 'bg-brand-100 text-brand-700 dark:bg-brand-400/[0.11] dark:text-brand-200'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/[0.1] dark:text-emerald-200';

  return (
    <li>
      <Link to={destination} className="group flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.035] sm:px-5">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${iconClass}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium tracking-[-0.01em] text-slate-900 dark:text-slate-100">{item.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {capitalize(item.module)}{item.context ? ` · ${item.context}` : ''} · {formatHumanDate(item.date)}
          </p>
        </div>
        <div className="shrink-0 text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
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
