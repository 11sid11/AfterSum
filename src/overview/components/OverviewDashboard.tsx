/** Read-only overview across Track, Split and Lend. */

import { Link } from '@tanstack/react-router';
import { Card, Money, EmptyState, Spinner } from '@components/ui';
import { useOverviewSummary, useGlobalActivity } from '../queries';
import { toMonthKey, fromMonthKey, formatHumanDate } from '@shared/dates';
import {
  ArrowUpRight,
  ChevronRight,
  HandCoins,
  Receipt,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import { useAppSettings } from '@shared/settings/useSettings';
import type { ActivityItem } from '../projections/types';

export function OverviewDashboard({ month = toMonthKey() }: { month?: string }) {
  const summary = useOverviewSummary(month);
  const activity = useGlobalActivity(8);
  const settings = useAppSettings();
  if (!summary || !settings) return <Spinner />;
  const hide = settings.hideAmounts;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <span className="module-chip mb-3"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {monthHeading(month)}</span>
          <h1 className="page-title">Your money, in one glance.</h1>
          <p className="page-subtitle">Track, trips and personal IOUs stay separate. This screen only brings the signal together.</p>
        </div>
      </header>

      <section className="hero-panel px-5 py-5 sm:px-7 sm:py-7">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="hero-kicker"><WalletCards size={12} /> Personal spending</span>
              <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-white/[0.45]">This month</p>
            </div>
            <Link
              to="/track"
              className="grid h-10 w-10 place-items-center rounded-[15px] border border-white/10 bg-white/[0.07] text-white/70 transition-[background-color,color,transform] duration-200 hover:-translate-y-px hover:bg-white/[0.11] hover:text-white"
              aria-label="Open Track"
            >
              <ArrowUpRight size={17} />
            </Link>
          </div>

          <p className="mt-2 text-[2.55rem] font-semibold leading-none tracking-[-0.055em] tabular-nums sm:text-[3.4rem]">
            <Money
              value={{ amountMinor: summary.personalSpending.totalMinor, currency: summary.personalSpending.currency }}
              hide={hide}
              emphasize
            />
          </p>
          <p className="mt-3 max-w-lg text-xs leading-5 text-white/[0.48]">Your own Track expenses plus your share of active Split expenses.</p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <HeroBreakdown
              to="/track"
              icon={<Receipt size={15} />}
              label="Track spending"
              amount={<Money value={{ amountMinor: summary.personalSpending.trackMinor, currency: summary.personalSpending.currency }} hide={hide} />}
            />
            <HeroBreakdown
              to="/split"
              icon={<Users size={15} />}
              label="Trip shares"
              amount={<Money value={{ amountMinor: summary.personalSpending.splitShareMinor, currency: summary.personalSpending.currency }} hide={hide} />}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="section-title">Money in motion</h2>
            <p className="mt-1 text-xs text-slate-400">What still needs to come back or go out.</p>
          </div>
          <span className="text-[11px] font-medium text-slate-400">Live balances</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
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
            <h2 className="section-title">Recent activity</h2>
            <p className="mt-1 text-xs text-slate-400">A neutral timeline across modules.</p>
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
            <ul className="stagger-list divide-y divide-slate-900/[0.055] dark:divide-white/[0.07]">
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

function HeroBreakdown({
  to,
  icon,
  label,
  amount,
}: {
  to: '/track' | '/split';
  icon: React.ReactNode;
  label: string;
  amount: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex min-w-0 items-center gap-3 rounded-[19px] border border-white/10 bg-white/[0.065] px-3.5 py-3 backdrop-blur transition-[background-color,transform] duration-200 hover:-translate-y-px hover:bg-white/[0.095]"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.08] text-white/[0.68]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold tabular-nums text-white/90">{amount}</span>
      </span>
      <ChevronRight size={15} className="text-white/25 transition-transform duration-200 group-hover:translate-x-0.5" />
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
    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';

  return (
    <Link to={to} className="group block">
      <Card className="surface-lift h-full">
        <div className="flex items-start justify-between gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-[15px] ${accentClass}`}>{icon}</div>
          <ChevronRight size={16} className="text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-slate-600" />
        </div>
        <div className="mt-4">
          <p className="text-[15px] font-semibold tracking-[-0.02em]">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-[17px] bg-emerald-500/[0.075] px-3 py-2.5 dark:bg-emerald-400/[0.07]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-emerald-700/[0.65] dark:text-emerald-300/[0.65]">Receive</p>
            <p className="mt-1 truncate text-[15px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              <Money value={{ amountMinor: receiveMinor, currency }} hide={hide} emphasize />
            </p>
          </div>
          <div className="rounded-[17px] bg-rose-500/[0.07] px-3 py-2.5 dark:bg-rose-400/[0.065]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-rose-700/60 dark:text-rose-300/[0.65]">Owe</p>
            <p className="mt-1 truncate text-[15px] font-semibold tabular-nums text-rose-700 dark:text-rose-300">
              <Money value={{ amountMinor: oweMinor, currency }} hide={hide} />
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ActivityRow({ item, hide }: { item: ActivityItem; hide: boolean }) {
  const icon = item.module === 'track' ? <Receipt size={15} /> : item.module === 'split' ? <Users size={15} /> : <HandCoins size={15} />;
  const destination = item.module === 'track' ? `/track/transaction/${item.sourceEntityId}` : item.module === 'split' ? '/split' : '/lend';
  const iconClass = item.module === 'track'
    ? 'bg-rose-500/[0.08] text-rose-600 dark:text-rose-300'
    : item.module === 'split'
      ? 'bg-brand-500/[0.09] text-brand-600 dark:text-brand-300'
      : 'bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300';

  return (
    <li>
      <Link to={destination} className="interactive-row group flex min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-[13px] ${iconClass}`}>{icon}</div>
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
