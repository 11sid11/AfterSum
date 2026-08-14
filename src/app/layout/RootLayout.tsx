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
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="glass-bar mx-auto flex h-[58px] w-full max-w-5xl items-center gap-2 rounded-[22px] px-2 sm:px-2.5">
          <Link
            to="/overview"
            className="group flex shrink-0 items-center gap-2.5 rounded-2xl px-1.5 py-1"
            aria-label="AfterSum overview"
          >
            <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-[14px] bg-[#17171d] shadow-soft-sm dark:bg-white">
              <span className="absolute left-[9px] top-[8px] h-[14px] w-[7px] rotate-[-12deg] rounded-[3px] bg-brand-400" />
              <span className="absolute bottom-[8px] right-[9px] h-[14px] w-[7px] rotate-[12deg] rounded-[3px] bg-white/95 dark:bg-[#17171d]" />
              <span className="absolute bottom-[7px] left-[16px] h-1.5 w-1.5 rounded-full bg-sky-300" />
            </span>
            <span className="hidden text-[15px] font-semibold tracking-[-0.035em] sm:block">AfterSum</span>
          </Link>

          <nav
            className="ml-2 hidden min-w-0 flex-1 items-center gap-1 rounded-[17px] bg-slate-900/[0.035] p-1 dark:bg-white/[0.045] sm:flex"
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
                    'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[13px] px-3 text-xs font-semibold transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.98]',
                    active
                      ? 'bg-[#17171d] text-white shadow-soft-xs dark:bg-white dark:text-slate-950'
                      : 'text-slate-500 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.055] dark:hover:text-white',
                  )}
                >
                  <Icon size={15} className={active ? 'text-brand-300 dark:text-brand-600' : undefined} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => navigate({ to: '/search' })}
              aria-label="Search"
              className="icon-button"
            >
              <SearchIcon size={17} />
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: '/settings' })}
              aria-label="Settings"
              className="icon-button"
            >
              <SettingsIcon size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-12">
        <div key={currentPath} className="page-enter">
          {children ?? <Outlet />}
        </div>
      </main>

      {showGlobalAdd && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Quick add"
          className="fixed bottom-[5.8rem] right-4 z-30 grid h-14 w-14 place-items-center rounded-[20px] border border-white/10 bg-[#17171d] text-white shadow-soft-lg transition-[transform,box-shadow] duration-200 active:scale-95 dark:bg-white dark:text-slate-950 sm:hidden"
        >
          <span className="absolute inset-1 rounded-[16px] bg-brand-500/10" aria-hidden="true" />
          <Plus size={22} className="relative" strokeWidth={2.4} />
        </button>
      )}

      <nav className="mobile-nav-safe fixed inset-x-0 bottom-0 z-30 px-3 sm:hidden" aria-label="Primary navigation">
        <div className="glass-bar mx-auto grid max-w-md grid-cols-4 rounded-[24px] p-1.5">
          {NAV.map((item) => {
            const active = isActivePath(currentPath, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  'relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[18px] text-[10px] font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.97]',
                  active
                    ? 'bg-[#17171d] text-white shadow-soft-xs dark:bg-white dark:text-slate-950'
                    : 'text-slate-500 active:bg-slate-900/[0.04] dark:text-slate-400 dark:active:bg-white/[0.05]',
                )}
              >
                <Icon size={18} className={active ? 'text-brand-300 dark:text-brand-600' : undefined} />
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
