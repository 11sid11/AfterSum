/**
 * Data & Backup page.
 *
 * IndexedDB is always the canonical database. Local exports and optional
 * Google Sheets backup are explicit user actions.
 */

import { useEffect, useState } from 'react';
import { Card, Button, useToast, Spinner } from '@components/ui';
import { Database, Download, Upload, FileSpreadsheet } from 'lucide-react';
import {
  exportBackup,
  validateBackup,
  restoreBackup,
  summarizeBackup,
} from '@/export/json/backup';
import { buildFullZip } from '@/export/zip/builder';
import { csvOfTrackTransactions } from '@/export/csv/serializer';
import { getDB } from '@db/database';
import { toMonthKey } from '@shared/dates';
import { persistBrowserStorage, isPersisted } from '@shared/storage';
import { markDirty } from '@sync/status';
import { useAppSettings } from '@shared/settings/useSettings';
import { GoogleSheetsBackupCard } from './GoogleSheetsBackupCard';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BackupPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const toast = useToast();
  const settings = useAppSettings();

  useEffect(() => {
    void isPersisted().then(setPersisted);
  }, []);

  const exportJson = async () => {
    setBusy('json');
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `aftersum-backup-${stamp}.json`);
      toast.show('JSON backup downloaded');
    } catch (e) {
      toast.show('Export failed: ' + (e instanceof Error ? e.message : String(e)), {
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const importJson = async (file: File) => {
    setBusy('restore');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const valid = validateBackup(parsed);
      const summary = summarizeBackup(valid);

      const safety = await exportBackup();
      const safetyBlob = new Blob([JSON.stringify(safety, null, 2)], {
        type: 'application/json',
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(safetyBlob, `aftersum-pre-restore-${stamp}.json`);

      await restoreBackup(valid);
      await markDirty();
      toast.show(
        `Restored ${summary.people} people, ${summary.trackTransactions} Track, ${summary.splitExpenses} Split, ${summary.lendEntries} Lend entries. Safety backup downloaded.`,
      );
    } catch (e) {
      toast.show('Restore failed: ' + (e instanceof Error ? e.message : String(e)), {
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const exportZip = async () => {
    setBusy('zip');
    try {
      const blob = await buildFullZip();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `aftersum-export-${stamp}.zip`);
      toast.show('CSV package downloaded');
    } catch (e) {
      toast.show('Export failed: ' + (e instanceof Error ? e.message : String(e)), {
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const exportMonth = async () => {
    setBusy('month');
    try {
      const month = toMonthKey();
      const db = getDB();
      const [transactions, categories] = await Promise.all([
        db.trackTransactions.toArray(),
        db.trackCategories.toArray(),
      ]);
      const filtered = transactions.filter((t) => !t.deletedAt && t.date.startsWith(month));
      const csv = csvOfTrackTransactions(
        filtered,
        categories,
        settings?.defaultCurrency ?? 'INR',
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `track-${month}.csv`);
      toast.show(`Exported ${filtered.length} transactions for ${month}`);
    } catch (e) {
      toast.show('Export failed: ' + (e instanceof Error ? e.message : String(e)), {
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold">Data &amp; Backup</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Your data stays on this device unless you explicitly export or back it up.
        </p>
      </header>

      <Card>
        <h2 className="section-title mb-2">On-device storage</h2>
        <p className="text-sm">
          <Database size={16} className="mr-1 inline" /> Local database available
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Persistent storage:{' '}
          <strong>
            {persisted === null ? 'checking…' : persisted ? 'Enabled' : 'Not guaranteed'}
          </strong>
        </p>
        {!persisted && (
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const res = await persistBrowserStorage();
                setPersisted(res.persisted);
                toast.show(
                  res.persisted
                    ? 'Persistent storage enabled.'
                    : 'Browser declined. Your data remains local but could be evicted under storage pressure.',
                );
              }}
            >
              Request persistent storage
            </Button>
          </div>
        )}
      </Card>

      <GoogleSheetsBackupCard />

      <Card>
        <h2 className="section-title mb-2">Back up or inspect your data</h2>
        <div className="space-y-2">
          <Button block onClick={() => void exportJson()} disabled={!!busy}>
            {busy === 'json' ? <Spinner /> : <Download size={16} />} Export full JSON backup
          </Button>
          <Button block variant="secondary" onClick={() => void exportZip()} disabled={!!busy}>
            {busy === 'zip' ? <Spinner /> : <FileSpreadsheet size={16} />} Export CSV package (ZIP)
          </Button>
          <Button block variant="secondary" onClick={() => void exportMonth()} disabled={!!busy}>
            {busy === 'month' ? <Spinner /> : <FileSpreadsheet size={16} />} Export current Track month
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="section-title mb-2">Restore local backup</h2>
        <p className="text-xs text-slate-500">
          Restoring replaces local data. AfterSum downloads a safety backup of the current state first.
        </p>
        <label className="mt-3 block">
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await importJson(file);
              e.target.value = '';
            }}
          />
          <span className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            {busy === 'restore' ? <Spinner /> : <Upload size={16} />} Restore from JSON backup
          </span>
        </label>
      </Card>
    </div>
  );
}
