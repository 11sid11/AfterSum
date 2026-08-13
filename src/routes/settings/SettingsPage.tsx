/** Settings landing page. */

import { Link } from '@tanstack/react-router';
import { Card, Toggle, Spinner, CurrencyPicker, useToast } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { settingsRepository } from '@shared/settings/repository';
import { Users, Database, ChevronRight, Eye, EyeOff, Sun, Moon, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';

export function SettingsPage() {
  const settings = useAppSettings();
  const toast = useToast();

  const stats = useLiveQuery(async () => {
    const db = getDB();
    const [peopleRows, track, groups, lendLedgers, budgets] = await Promise.all([
      db.people.toArray(),
      db.trackTransactions.count(),
      db.splitGroups.count(),
      db.lendLedgers.count(),
      db.trackBudgets.count(),
    ]);
    return {
      people: peopleRows.filter((person) => !person.deletedAt).length,
      track,
      groups,
      lendLedgers,
      budgets,
    };
  }, []);

  if (!settings) return <Spinner />;
  const hasFinancialData = !!stats && stats.track + stats.groups + stats.lendLedgers + stats.budgets > 0;

  const setTheme = (mode: 'system' | 'light' | 'dark') => {
    void settingsRepository.setTheme(mode).catch((error) => {
      toast.show(error instanceof Error ? error.message : 'Could not change theme', { variant: 'error' });
    });
  };

  const themeButton = (mode: 'system' | 'light' | 'dark', icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setTheme(mode)}
      className={clsx(
        'flex min-h-11 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-xs transition-colors',
        settings.theme === mode
          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200'
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
      )}
      aria-pressed={settings.theme === mode}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      <Card>
        <h2 className="section-title mb-2">Appearance</h2>
        <div className="grid grid-cols-3 gap-2">
          {themeButton('system', <Monitor size={18} />, 'System')}
          {themeButton('light', <Sun size={18} />, 'Light')}
          {themeButton('dark', <Moon size={18} />, 'Dark')}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Privacy mode</p>
            <p className="text-xs text-slate-500">Hide monetary amounts across the app.</p>
          </div>
          <Toggle
            checked={settings.hideAmounts}
            onChange={(value) => {
              void settingsRepository.setHideAmounts(value);
              toast.show(value ? 'Privacy mode on' : 'Privacy mode off');
            }}
            id="privacy-toggle"
          />
          <span className="sr-only">
            {settings.hideAmounts ? <EyeOff size={18} /> : <Eye size={18} />}
          </span>
        </div>
      </Card>

      <Card>
        <h2 className="section-title mb-2">Main currency</h2>
        {hasFinancialData ? (
          <div>
            <p className="text-sm font-semibold">{settings.defaultCurrency}</p>
            <p className="mt-1 text-xs text-slate-500">
              Locked after financial data is recorded so historical amounts are never relabelled as another currency.
            </p>
          </div>
        ) : (
          <CurrencyPicker
            value={settings.defaultCurrency}
            onChange={(currency) => {
              void settingsRepository.setDefaultCurrency(currency).catch((error) =>
                toast.show(error instanceof Error ? error.message : 'Could not change currency', { variant: 'error' }),
              );
            }}
          />
        )}
      </Card>

      <Card padded={false}>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          <li>
            <Link
              to="/settings/people"
              className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Users size={18} className="shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">People</p>
                  <p className="text-xs text-slate-500">{stats?.people ?? '…'} people</p>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-400" />
            </Link>
          </li>
          <li>
            <Link
              to="/settings/backup"
              className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Database size={18} className="shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Data &amp; Storage</p>
                  <p className="truncate text-xs text-slate-500">Persistence, usage, recovery and exports</p>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-400" />
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}
