/** Settings landing page. */

import { Link } from '@tanstack/react-router';
import { Card, Toggle, Spinner, CurrencyPicker, useToast } from '@components/ui';
import { useAppSettings, useSettingsStats } from '@shared/settings/useSettings';
import { settingsRepository } from '@shared/settings/repository';
import { Users, Database, ChevronRight, Eye, EyeOff, Sun, Moon, Monitor } from 'lucide-react';
import clsx from 'clsx';

export function SettingsPage() {
  const settings = useAppSettings();
  const stats = useSettingsStats();
  const toast = useToast();

  if (!settings) return <Spinner />;
  const hasFinancialData = !!stats && stats.track + stats.lendEntries + stats.budgets > 0;

  const setTheme = (mode: 'system' | 'light' | 'dark') => {
    void settingsRepository.setTheme(mode).catch((error) => {
      toast.show(error instanceof Error ? error.message : 'Could not change theme', { variant: 'error' });
    });
  };

  const setPrivacyMode = async (value: boolean) => {
    try {
      await settingsRepository.setHideAmounts(value);
      toast.show(value ? 'Privacy mode on' : 'Privacy mode off');
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not change privacy mode', {
        variant: 'error',
      });
    }
  };

  const themeButton = (mode: 'system' | 'light' | 'dark', icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setTheme(mode)}
      className={clsx(
        'flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium transition-all',
        settings.theme === mode
          ? 'border-brand-300 bg-brand-50 text-brand-700 shadow-sm dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white',
      )}
      aria-pressed={settings.theme === mode}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Appearance, privacy, people and local data controls.</p>
      </header>

      <section>
        <h2 className="section-title mb-2.5">Appearance</h2>
        <Card>
          <div className="grid grid-cols-3 gap-2.5">
            {themeButton('system', <Monitor size={18} />, 'System')}
            {themeButton('light', <Sun size={18} />, 'Light')}
            {themeButton('dark', <Moon size={18} />, 'Dark')}
          </div>
        </Card>
      </section>

      <section>
        <h2 className="section-title mb-2.5">Preferences</h2>
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Privacy mode</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">Hide monetary amounts across the app.</p>
            </div>
            <Toggle
              checked={settings.hideAmounts}
              onChange={(value) => void setPrivacyMode(value)}
              id="privacy-toggle"
            />
            <span className="sr-only">{settings.hideAmounts ? <EyeOff size={18} /> : <Eye size={18} />}</span>
          </div>

          <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
            <p className="text-sm font-semibold">Main currency</p>
            {hasFinancialData ? (
              <div className="mt-2 rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-800/[0.55]">
                <p className="text-sm font-semibold">{settings.defaultCurrency}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Locked after financial data is recorded so historical amounts are never relabelled.</p>
              </div>
            ) : (
              <div className="mt-2">
                <CurrencyPicker
                  value={settings.defaultCurrency}
                  onChange={(currency) => {
                    void settingsRepository.setDefaultCurrency(currency).catch((error) =>
                      toast.show(error instanceof Error ? error.message : 'Could not change currency', { variant: 'error' }),
                    );
                  }}
                  label=""
                />
              </div>
            )}
          </div>
        </Card>
      </section>

      <section>
        <h2 className="section-title mb-2.5">Manage</h2>
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            <li>
              <Link to="/settings/people" className="group flex min-h-16 items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/[0.45] sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><Users size={18} /></div>
                  <div className="min-w-0"><p className="text-sm font-semibold">People</p><p className="mt-0.5 text-xs text-slate-500">{stats?.people ?? '…'} people</p></div>
                </div>
                <ChevronRight size={17} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
            <li>
              <Link to="/settings/backup" className="group flex min-h-16 items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/[0.45] sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><Database size={18} /></div>
                  <div className="min-w-0"><p className="text-sm font-semibold">Data &amp; Storage</p><p className="mt-0.5 truncate text-xs text-slate-500">Persistence, recovery, backups and exports</p></div>
                </div>
                <ChevronRight size={17} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
