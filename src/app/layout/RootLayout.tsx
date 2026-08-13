/**
 * Root layout — app shell for the four primary product areas.
 *
 * Phones use the familiar bottom tab bar. Wider screens expose the
 * same destinations in the header so desktop users are not forced
 * into a mobile navigation pattern.
 */

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
      <div className="mx-auto min-h-screen max-w-screen-lg bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <main className="min-h-screen px-4 py-6">{children ?? <Outlet />}</main>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-screen-lg flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:py-2.5">
        <div className="flex items-center gap-3">
          <Link to="/overview" className="shrink-0 py-2 text-base font-semibold tracking-tight">
            AfterSum
          </Link>

          <nav className="ml-3 hidden min-w-0 flex-1 items-center gap-1 sm:flex" aria-label="Primary navigation">
            {NAV.map((item) => {
              const active = isActivePath(currentPath, item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={clsx(
                    'inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                  )}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => navigate({ to: '/search' })}
              aria-label="Search"
              className="grid h-11 w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <SearchIcon size={18} />
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: '/settings' })}
              aria-label="Settings"
              className="grid h-11 w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-4 pb-24 sm:pb-8">{children ?? <Outlet />}</main>

      {showGlobalAdd && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Quick add"
          className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 sm:hidden"
        >
          <Plus size={24} />
        </button>
      )}

      <nav
        className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:hidden"
        aria-label="Primary navigation"
      >
        {NAV.map((item) => {
          const active = isActivePath(currentPath, item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(
                'flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs',
                active
                  ? 'text-brand-600 dark:text-brand-300'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200',
              )}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {addOpen && <AddMenu onClose={() => setAddOpen(false)} />}
    </div>
  );
}
