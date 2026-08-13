/** Root layout — responsive shell for AfterSum's four primary areas. */

import { type ReactNode, useState } from 'react';
import { Outlet, Link, useRouterState, useNavigate } from '@tanstack/react-router';
import {
  Home,
  Receipt,
  Users,
  HandCoins,
  Settings as SettingsIcon,
  Plus,
  Search as SearchIcon,
  WalletCards,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppSettings } from '@shared/settings/useSettings';
import { AddMenu } from './AddMenu';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: Home },
  { to: '/track', label: 'Track', icon: Receipt },
  { to: '/split', label: 'Split', icon: Users },
  { to: '/lend', label: 'Lend', icon: HandCoins },
];

function isActivePath(currentPath: string, to: string): boolean {
  return currentPath === to || currentPath.startsWith(`${to}/`);
}

export function RootLayout({ children }: { children?: ReactNode }) {
  const settings = useAppSettings();
  const navigate = useNavigate();
  const state = useRouterState();
  const [addOpen, setAddOpen] = useState(false);
  const currentPath = state.location.pathname;
  const isOnboarding = currentPath.startsWith('/onboarding');
  const showGlobalAdd = currentPath === '/overview';

  if (settings && !settings.onboardingComplete && !isOnboarding) {
    queueMicrotask(() => navigate({ to: '/onboarding' }));
  }

  if (isOnboarding) {
    return (
      <div className="min-h-screen text-slate-950 dark:text-slate-100">
        <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
          {children ?? <Outlet />}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link to="/overview" className="flex shrink-0 items-center gap-2.5" aria-label="AfterSum overview">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/20">
              <WalletCards size={18} />
            </span>
            <span className="hidden text-[15px] font-semibold tracking-tight sm:block">AfterSum</span>
          </Link>

          <nav className="ml-3 hidden min-w-0 flex-1 items-center gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900 sm:flex" aria-label="Primary navigation">
            {NAV.map((item) => {
              const active = isActivePath(currentPath, item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={clsx(
                    'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors',
                    active
                      ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                  )}
                >
                  <Icon size={16} className={active ? 'text-brand-600 dark:text-brand-300' : undefined} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => navigate({ to: '/search' })} aria-label="Search" className="icon-button">
              <SearchIcon size={18} />
            </button>
            <button type="button" onClick={() => navigate({ to: '/settings' })} aria-label="Settings" className="icon-button">
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-28 sm:px-6 sm:py-7 sm:pb-10">
        {children ?? <Outlet />}
      </main>

      {showGlobalAdd && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Quick add"
          className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-xl shadow-brand-600/25 active:scale-95 sm:hidden"
        >
          <Plus size={23} />
        </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:hidden" aria-label="Primary navigation">
        <div className="mx-auto grid max-w-md grid-cols-4 rounded-[22px] border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
          {NAV.map((item) => {
            const active = isActivePath(currentPath, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium',
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-200'
                    : 'text-slate-500 active:bg-slate-100 dark:text-slate-400 dark:active:bg-slate-800',
                )}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {addOpen && <AddMenu onClose={() => setAddOpen(false)} />}
    </div>
  );
}
