/** Root layout — responsive shell for AfterSum's four primary areas. */

import { type ReactNode, useEffect, useState } from 'react';
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

const APP_ICON_URL = `${import.meta.env.BASE_URL}pwa-192x192.png`;

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

  useEffect(() => {
    if (settings && !settings.onboardingComplete && !isOnboarding) {
      void navigate({ to: '/onboarding', replace: true });
    }
  }, [isOnboarding, navigate, settings]);

  if (isOnboarding) {
    return (
      <div className="min-h-screen bg-[#f7f8fc] text-slate-950 dark:bg-[#0b0e14] dark:text-slate-100">
        <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
          {children ?? <Outlet />}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-950 dark:bg-[#0b0e14] dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#f7f8fc]/95 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#0b0e14]/95 sm:border-0 sm:bg-transparent sm:px-5 sm:pt-4 dark:sm:bg-transparent">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-3 sm:h-[58px] sm:rounded-[18px] sm:border sm:border-slate-200/80 sm:bg-white/[0.92] sm:px-2.5 sm:shadow-[0_1px_2px_rgb(15_23_42/0.025),0_5px_18px_rgb(15_23_42/0.035)] sm:backdrop-blur-xl dark:sm:border-white/[0.075] dark:sm:bg-[#141821]/[0.92] dark:sm:shadow-none">
          <Link
            to="/overview"
            className="group flex shrink-0 items-center gap-2.5 rounded-xl px-1 py-1"
            aria-label="AfterSum overview"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[11px] bg-white shadow-[0_3px_10px_rgb(98_77_223/0.18)] ring-1 ring-slate-200/70 dark:bg-[#11151d] dark:ring-white/[0.08]">
              <img
                src={APP_ICON_URL}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 object-cover"
                aria-hidden="true"
              />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.03em] text-brand-700 dark:text-brand-300">AfterSum</span>
          </Link>

          <nav
            className="ml-3 hidden min-w-0 flex-1 items-center justify-center gap-1 sm:flex"
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
                    'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.98]',
                    active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-400/[0.13] dark:text-brand-200'
                      : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.055] dark:hover:text-white',
                  )}
                >
                  <Icon size={15} />
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

      <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-28 sm:px-6 sm:py-8 sm:pb-12">
        <div key={currentPath} className="page-enter">
          {children ?? <Outlet />}
        </div>
      </main>

      {showGlobalAdd && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Quick add"
          className="fixed bottom-[5.65rem] right-4 z-30 grid h-14 w-14 place-items-center rounded-[17px] border border-brand-500 bg-brand-600 text-white shadow-[0_8px_22px_rgb(98_77_223/0.28)] transition-[transform,background-color] duration-200 hover:bg-brand-700 active:scale-95 dark:border-brand-300 dark:bg-brand-400 dark:text-brand-950"
        >
          <Plus size={22} strokeWidth={2.4} />
        </button>
      )}

      <nav className="mobile-nav-safe fixed inset-x-0 bottom-0 z-30 sm:hidden" aria-label="Primary navigation">
        <div className="mx-auto grid max-w-md grid-cols-4 rounded-t-[20px] border border-b-0 border-slate-200/[0.85] bg-white/[0.96] px-2 pt-1.5 shadow-[0_-8px_28px_rgb(15_23_42/0.055)] backdrop-blur-xl dark:border-white/[0.075] dark:bg-[#141821]/[0.96] dark:shadow-none">
          {NAV.map((item) => {
            const active = isActivePath(currentPath, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  'relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[13px] px-1 text-[10px] font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.97]',
                  active
                    ? 'bg-brand-600 text-white shadow-[0_3px_10px_rgb(98_77_223/0.18)] dark:bg-brand-400 dark:text-brand-950'
                    : 'text-slate-500 active:bg-slate-100 dark:text-slate-400 dark:active:bg-white/[0.05]',
                )}
              >
                <Icon size={18} />
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
