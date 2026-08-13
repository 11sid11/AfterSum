/**
 * Root layout — app shell for the four primary product areas.
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
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center justify-between gap-2">
          <Link to="/overview" className="text-base font-semibold tracking-tight">
            AfterSum
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate({ to: '/search' })}
              aria-label="Search"
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <SearchIcon size={18} />
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: '/settings' })}
              aria-label="Settings"
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-24 sm:pb-6">{children ?? <Outlet />}</main>

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

      <nav className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        {NAV.map((item) => {
          const active = currentPath === item.to || currentPath.startsWith(`${item.to}/`);
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
