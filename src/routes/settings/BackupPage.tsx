/**
 * Data & Backup page.
 *
 * Lets the user:
 *   - see on-device data status
 *   - request persistent storage
 *   - export JSON backup (full DB)
 *   - restore JSON backup
 *   - export CSV package (ZIP)
 *   - export current Track month
 *   - export current Split group
 *   - connect Google Drive (stub)
 */

import { useState } from 'react';
import { Card, Button, useToast, Spinner } from '@components/ui';
import { Database, Download, Upload, FileSpreadsheet, Cloud } from 'lucide-react';
import {
  exportBackup,
  validateBackup,
  restoreBackup,
  summarizeBackup,
  type Backup,
} from '@/export/json/backup';
import { buildFullZip } from '@/export/zip/builder';
import { csvOfTrackTransactions } from '@/export/csv/serializer';
import { getDB } from '@db/database';
import { toMonthKey } from '@shared/dates';
import { persistBrowserStorage, isPersisted } from '@shared/storage';
import { useEffect } from 'react';
import { markDirty } from '@sync/status';

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

  useEffect(() => {
    isPersisted().then(setPersisted);
  }, []);

  const exportJson = async () => {
    setBusy('json');
    try {
      const b = await exportBackup();
      const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `finance-backup-${stamp}.json`);
      toast.show('JSON backup downloaded');
    } catch (e) {
      toast.show('Export failed: ' + (e instanceof Error ? e.message : String(e)));
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
      // safety backup first
      const safety = await exportBackup();
      const safetyBlob = new Blob([JSON.stringify(safety, null, 2)], { type: 'application/json' });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(safetyBlob, `finance-pre-restore-safety-${stamp}.json`);
      await restoreBackup(valid);
      await markDirty();
      toast.show(
        `Restored ${summary.people} people, ${summary.trackTransactions} track, ${summary.splitExpenses} split, ${summary.lendEntries} lend. Safety backup downloaded.`,
      );
    } catch (e) {
      toast.show('Restore failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const exportZip = async () => {
    setBusy('zip');
    try {
      const blob = await buildFullZip();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `finance-export-${stamp}.zip`);
      toast.show('ZIP package downloaded');
    } catch (e) {
      toast.show('Export failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const exportMonth = async () => {
    setBusy('month');
    try {
      const month = toMonthKey();
      const db = getDB();
      const [tx, cats] = await Promise.all([db.trackTransactions.toArray(), db.trackCategories.toArray()]);
      const filtered = tx.filter((t) => !t.deletedAt && t.date.startsWith(month));
      const csv = csvOfTrackTransactions(filtered, cats, 'INR');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `track-${month}.csv`);
      toast.show(`Exported ${filtered.length} transactions for ${month}`);
    } catch (e) {
      toast.show('Export failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Data &amp; Backup</h1>

      <Card>
        <h2 className="section-title mb-2">On-device data</h2>
        <p className="text-sm">
          <Database size={16} className="mr-1 inline" /> Available (Dexie / IndexedDB)
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Persistent storage:{' '}
          <strong>
            {persisted === null ? 'checking…' : persisted ? 'Enabled' : 'Not guaranteed'}
          </strong>
        </p>
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const res = await persistBrowserStorage();
              setPersisted(res.persisted);
              toast.show(
                res.persisted
                  ? 'Browser granted persistent storage.'
                  : 'Browser declined; data is still in IndexedDB but may be evicted under pressure.',
              );
            }}
          >
            Request persistent storage
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="section-title mb-2">Google Drive</h2>
        <p className="text-sm text-slate-500">
          Optional cloud backup. Local app works without Google.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.show('Google Drive integration is a stub in this build.')}
          >
            <Cloud size={16} /> Connect Google Drive
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.show('Sync is a stub. Local app continues to work.')}
          >
            Sync now
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="section-title mb-2">Export</h2>
        <div className="space-y-2">
          <Button block onClick={exportJson} disabled={!!busy}>
            {busy === 'json' ? <Spinner /> : <Download size={16} />} Export JSON backup
          </Button>
          <Button block variant="secondary" onClick={exportZip} disabled={!!busy}>
            {busy === 'zip' ? <Spinner /> : <FileSpreadsheet size={16} />} Export CSV package (ZIP)
          </Button>
          <Button block variant="secondary" onClick={exportMonth} disabled={!!busy}>
            {busy === 'month' ? <Spinner /> : <FileSpreadsheet size={16} />} Export current Track month (CSV)
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="section-title mb-2">Restore</h2>
        <p className="text-xs text-slate-500">
          Pick a JSON backup file. A safety backup of the current state is downloaded
          before any data is replaced.
        </p>
        <label className="mt-3 block">
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await importJson(f);
              e.target.value = '';
            }}
          />
          <span className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            {busy === 'restore' ? <Spinner /> : <Upload size={16} />} Restore from JSON backup
          </span>
        </label>
      </Card>
    </div>
  );
}

void ({} as Backup);
