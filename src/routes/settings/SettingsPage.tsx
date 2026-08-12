/**
 * Settings landing page.
 */

import { Link } from '@tanstack/react-router';
import { Card, Toggle, Spinner } from '@components/ui';
import { useAppSettings } from '@shared/settings/useSettings';
import { settingsRepository } from '@shared/settings/repository';
import { CurrencyPicker } from '@components/ui';
import { useToast } from '@components/ui';
import { Users, Database, ChevronRight, Eye, EyeOff, Sun, Moon, Monitor } from 'lucide-react';
import { persistBrowserStorage, isPersisted } from '@shared/storage';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';

export function SettingsPage() {
  const settings = useAppSettings();
  const toast = useToast();
  const [persisted, setPersisted] = useState<boolean | null>(null);

  const stats = useLiveQuery(async () => {
    const db = getDB();
    const [people, t, g, l, e] = await Promise.all([
      db.people.count(),
      db.trackTransactions.count(),
      db.splitGroups.count(),
      db.lendLedgers.count(),
      db.splitExpenses.count(),
    ]);
    return { people, t, g, l, e };
  }, []);

  useEffect(() => {
    isPersisted().then(setPersisted);
  }, []);

  if (!settings) return <Spinner />;

  const themeButton = (mode: 'system' | 'light' | 'dark', icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => settingsRepository.setTheme(mode)}
      className={clsx(
        'flex flex-col items-center gap-1 rounded-xl border px-3 py-2 text-xs',
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Privacy mode</p>
            <p className="text-xs text-slate-500">Hide all amounts across the app.</p>
          </div>
          <Toggle
            checked={settings.hideAmounts}
            onChange={(v) => {
              settingsRepository.setHideAmounts(v);
              toast.show(v ? 'Privacy mode on' : 'Privacy mode off');
            }}
            id="privacy-toggle"
          />
          <span className="sr-only">{settings.hideAmounts ? <EyeOff size={18} /> : <Eye size={18} />}</span>
        </div>
      </Card>

      <Card>
        <h2 className="section-title mb-2">Default currency</h2>
        <CurrencyPicker
          value={settings.defaultCurrency}
          onChange={(c) => settingsRepository.setDefaultCurrency(c)}
        />
      </Card>

      <Card>
        <h2 className="section-title mb-2">Persistent storage</h2>
        <p className="mb-3 text-sm text-slate-500">
          Status:{' '}
          <strong>
            {persisted === null ? 'checking…' : persisted ? 'Enabled' : 'Not guaranteed'}
          </strong>
        </p>
        <button
          type="button"
          className="text-sm font-medium text-brand-600 hover:underline"
          onClick={async () => {
            const res = await persistBrowserStorage();
            setPersisted(res.persisted);
            toast.show(
              res.persisted
                ? 'Browser granted persistent storage'
                : 'Browser declined; data is still in IndexedDB but may be evicted under pressure.',
            );
          }}
        >
          Request persistent storage
        </button>
      </Card>

      <Card padded={false}>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          <li>
            <Link to="/settings/people" className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <Users size={18} className="text-slate-500" />
                <div>
                  <p className="text-sm font-medium">People</p>
                  <p className="text-xs text-slate-500">{stats?.people ?? '…'} people</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </Link>
          </li>
          <li>
            <Link to="/settings/backup" className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <Database size={18} className="text-slate-500" />
                <div>
                  <p className="text-sm font-medium">Data &amp; Backup</p>
                  <p className="text-xs text-slate-500">JSON, CSV, Google Drive</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}
