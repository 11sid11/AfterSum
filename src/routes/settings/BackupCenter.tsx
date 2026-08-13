import { useEffect, useState } from 'react';
import {
  Database,
  Download,
  FileSpreadsheet,
  History,
  RefreshCw,
  Share2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Card, Button, useToast, Spinner } from '@components/ui';
import {
  exportBackup,
  validateBackup,
  restoreBackup,
  summarizeBackup,
} from '@/export/json/backup';
import {
  createRecoverySnapshot,
  listRecoverySnapshots,
  restoreRecoverySnapshot,
} from '@/backup/recovery';
import { createPortableBackupFile, shareOrDownloadBackup } from '@/backup/portable';
import { buildFullZip } from '@/export/zip/builder';
import { csvOfTrackTransactions } from '@/export/csv/serializer';
import { getDB } from '@db/database';
import type { RecoverySnapshot } from '@db/schema';
import { formatHumanDateTime, nowISO, toMonthKey } from '@shared/dates';
import {
  getBrowserStorageInfo,
  persistBrowserStorage,
  type BrowserStorageInfo,
} from '@shared/storage';
import { settingsRepository } from '@shared/settings/repository';
import { useAppSettings } from '@shared/settings/useSettings';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function BackupCenter() {
  const [busy, setBusy] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<BrowserStorageInfo | null>(null);
  const [portableDataBytes, setPortableDataBytes] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<RecoverySnapshot[]>([]);
  const toast = useToast();
  const settings = useAppSettings();

  const refreshSnapshots = async () => {
    setSnapshots(await listRecoverySnapshots());
  };

  const refreshStorage = async () => {
    const info = await getBrowserStorageInfo();
    setStorageInfo(info);

    try {
      const backup = await exportBackup();
      setPortableDataBytes(new Blob([JSON.stringify(backup)]).size);
    } catch {
      setPortableDataBytes(null);
    }
  };

  useEffect(() => {
    void refreshStorage();
    void refreshSnapshots();
  }, []);

  const requestPersistentStorage = async () => {
    setBusy('storage');
    try {
      const result = await persistBrowserStorage();
      await refreshStorage();

      if (!result.supported) {
        toast.show('Persistent storage is not supported by this browser.', { variant: 'error' });
      } else if (result.persisted) {
        toast.show('Persistent storage enabled.', { variant: 'success' });
      } else {
        toast.show('Browser declined persistence. Data remains local but may be cleared under storage pressure.');
      }
    } finally {
      setBusy(null);
    }
  };

  const savePortableBackup = async () => {
    setBusy('portable');
    try {
      const backup = await exportBackup();
      const result = await shareOrDownloadBackup(createPortableBackupFile(backup));
      if (result === 'cancelled') return;

      await settingsRepository.setLastPortableBackupAt(nowISO());
      toast.show(result === 'shared' ? 'Backup ready in the system share sheet.' : 'Portable backup downloaded.');
    } catch (error) {
      toast.show('Backup failed: ' + errorMessage(error), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const importPortableBackup = async (file: File) => {
    setBusy('restore-file');
    try {
      const valid = validateBackup(JSON.parse(await file.text()));
      const summary = summarizeBackup(valid);
      const confirmed = window.confirm(
        `Restore the backup from ${formatHumanDateTime(valid.exportedAt)}? Current financial records on this device will be replaced. A local recovery checkpoint will be created first.`,
      );
      if (!confirmed) return;

      await createRecoverySnapshot('before_restore');
      await restoreBackup(valid);
      await Promise.all([refreshSnapshots(), refreshStorage()]);
      toast.show(
        `Restored ${summary.people} people, ${summary.trackTransactions} Track, ${summary.splitExpenses} Split, and ${summary.lendEntries} Lend entries.`,
      );
    } catch (error) {
      toast.show('Restore failed: ' + errorMessage(error), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const restoreCheckpoint = async (snapshot: RecoverySnapshot) => {
    const confirmed = window.confirm(
      `Restore the local checkpoint from ${formatHumanDateTime(snapshot.createdAt)}? Current financial records will be replaced and another safety checkpoint will be created first.`,
    );
    if (!confirmed) return;

    setBusy(`checkpoint:${snapshot.id}`);
    try {
      const backup = await restoreRecoverySnapshot(snapshot.id);
      const summary = summarizeBackup(backup);
      await Promise.all([refreshSnapshots(), refreshStorage()]);
      toast.show(
        `Recovered ${summary.trackTransactions} Track, ${summary.splitExpenses} Split, and ${summary.lendEntries} Lend entries.`,
      );
    } catch (error) {
      toast.show('Recovery failed: ' + errorMessage(error), { variant: 'error' });
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
    } catch (error) {
      toast.show('Export failed: ' + errorMessage(error), { variant: 'error' });
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
      const filtered = transactions.filter(
        (transaction) => !transaction.deletedAt && transaction.date.startsWith(month),
      );
      const csv = csvOfTrackTransactions(
        filtered,
        categories,
        settings?.defaultCurrency ?? 'INR',
      );
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `track-${month}.csv`);
      toast.show(`Exported ${filtered.length} transactions for ${month}`);
    } catch (error) {
      toast.show('Export failed: ' + errorMessage(error), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const storagePercent =
    storageInfo?.usageBytes !== null &&
    storageInfo?.usageBytes !== undefined &&
    storageInfo?.quotaBytes !== null &&
    storageInfo?.quotaBytes !== undefined &&
    storageInfo.quotaBytes > 0
      ? Math.min(100, (storageInfo.usageBytes / storageInfo.quotaBytes) * 100)
      : null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold">Data &amp; Storage</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          No AfterSum account or backend. Data stays on this device unless you explicitly save a backup or export.
        </p>
      </header>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="section-title">On this device</h2>
            <p className="mt-1 text-sm">
              <Database size={16} className="mr-1 inline" /> IndexedDB local database
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshStorage()}
            aria-label="Refresh storage information"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <StorageStat
            label="Protection"
            value={
              storageInfo === null
                ? 'Checking…'
                : !storageInfo.persistenceSupported
                  ? 'Not supported'
                  : storageInfo.persisted
                    ? 'Persistent'
                    : 'Best effort'
            }
          />
          <StorageStat
            label="Browser storage used"
            value={storageInfo === null ? 'Checking…' : formatBytes(storageInfo.usageBytes)}
          />
          <StorageStat
            label="Browser quota"
            value={storageInfo === null ? 'Checking…' : formatBytes(storageInfo.quotaBytes)}
          />
          <StorageStat
            label="AfterSum backup data"
            value={portableDataBytes === null ? 'Unavailable' : `~${formatBytes(portableDataBytes)}`}
          />
        </dl>

        {storagePercent !== null && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max(storagePercent > 0 ? 1 : 0, storagePercent)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {storagePercent < 0.1 ? '<0.1' : storagePercent.toFixed(1)}% of the browser-reported quota is in use.
            </p>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Browser usage and quota are reported for this web origin, so they include AfterSum's database and offline cache and may include other data stored on the same host. “AfterSum backup data” is the approximate serialized size of your app records, not IndexedDB's exact on-disk size.
        </p>

        {storageInfo?.persistenceSupported && !storageInfo.persisted && (
          <Button
            className="mt-3"
            variant="secondary"
            size="sm"
            onClick={() => void requestPersistentStorage()}
            disabled={busy === 'storage'}
          >
            {busy === 'storage' ? <Spinner /> : <ShieldCheck size={16} />}
            Request persistent storage
          </Button>
        )}

        {storageInfo && !storageInfo.persistenceSupported && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            This browser does not expose the persistent-storage API. AfterSum will still use local IndexedDB, but the browser controls eviction.
          </p>
        )}
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <Share2 size={20} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <h2 className="text-sm font-semibold">Portable backup</h2>
            <p className="mt-1 text-xs text-slate-500">
              Save one complete AfterSum file somewhere outside this device. On supported phones, the system share sheet lets you choose where it goes without connecting an account to AfterSum.
            </p>
          </div>
        </div>
        {settings?.lastPortableBackupAt && (
          <p className="mt-3 text-xs text-slate-500">
            Last saved: <strong>{formatHumanDateTime(settings.lastPortableBackupAt)}</strong>
          </p>
        )}
        <Button className="mt-3" block onClick={() => void savePortableBackup()} disabled={!!busy}>
          {busy === 'portable' ? <Spinner /> : <Share2 size={16} />} Save portable backup
        </Button>
        <p className="mt-2 text-xs text-slate-500">
          This portable format is readable JSON. Keep the file somewhere private.
        </p>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <h2 className="text-sm font-semibold">Automatic recovery</h2>
            <p className="mt-1 text-xs text-slate-500">
              Keeps one rolling daily checkpoint, replacing the previous automatic copy, plus up to three pre-restore safety checkpoints. These help with mistakes but cannot recover a lost or reset device.
            </p>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">Your first automatic recovery checkpoint will be created automatically.</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {snapshot.reason === 'daily' ? 'Latest automatic recovery' : 'Before restore'}
                  </p>
                  <p className="text-xs text-slate-500">{formatHumanDateTime(snapshot.createdAt)}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void restoreCheckpoint(snapshot)}
                  disabled={!!busy}
                >
                  {busy === `checkpoint:${snapshot.id}` ? <Spinner /> : <History size={15} />} Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="section-title mb-2">Restore portable backup</h2>
        <p className="text-xs text-slate-500">
          Choose an AfterSum backup file. Restore is explicit and creates a local safety checkpoint first.
        </p>
        <label className="mt-3 block">
          <input
            type="file"
            accept="application/json,.json,.aftersum"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) await importPortableBackup(file);
              event.target.value = '';
            }}
          />
          <span className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            {busy === 'restore-file' ? <Spinner /> : <Upload size={16} />} Choose backup file
          </span>
        </label>
      </Card>

      <Card>
        <h2 className="section-title mb-2">Exports</h2>
        <p className="mb-3 text-xs text-slate-500">
          CSV is for spreadsheets and analysis. Use a portable backup when you want to restore AfterSum later.
        </p>
        <div className="space-y-2">
          <Button block variant="secondary" onClick={() => void exportZip()} disabled={!!busy}>
            {busy === 'zip' ? <Spinner /> : <Download size={16} />} Export CSV package (ZIP)
          </Button>
          <Button block variant="secondary" onClick={() => void exportMonth()} disabled={!!busy}>
            {busy === 'month' ? <Spinner /> : <FileSpreadsheet size={16} />} Export current Track month
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StorageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 truncate font-semibold">{value}</dd>
    </div>
  );
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return 'Unavailable';
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIndex]}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
