import { useEffect, useState } from 'react';
import {
  Database,
  Download,
  FileSpreadsheet,
  History,
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
import { persistBrowserStorage, isPersisted } from '@shared/storage';
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
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [snapshots, setSnapshots] = useState<RecoverySnapshot[]>([]);
  const toast = useToast();
  const settings = useAppSettings();

  const refreshSnapshots = async () => {
    setSnapshots(await listRecoverySnapshots());
  };

  useEffect(() => {
    void isPersisted().then(setPersisted);
    void refreshSnapshots();
  }, []);

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
      await refreshSnapshots();
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
      await refreshSnapshots();
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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold">Data &amp; Backup</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          No AfterSum account or backend. Data stays on this device unless you explicitly save a backup or export.
        </p>
      </header>

      <Card>
        <h2 className="section-title mb-2">On this device</h2>
        <p className="text-sm">
          <Database size={16} className="mr-1 inline" /> Local database available
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Persistent storage:{' '}
          <strong>{persisted === null ? 'checking…' : persisted ? 'Enabled' : 'Not guaranteed'}</strong>
        </p>
        {!persisted && (
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const result = await persistBrowserStorage();
                setPersisted(result.persisted);
                toast.show(
                  result.persisted
                    ? 'Persistent storage enabled.'
                    : 'Browser declined. Data remains local but could be evicted under storage pressure.',
                );
              }}
            >
              Request persistent storage
            </Button>
          </div>
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
          This first portable format is readable JSON. Keep the file somewhere private.
        </p>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <h2 className="text-sm font-semibold">Automatic recovery</h2>
            <p className="mt-1 text-xs text-slate-500">
              Keeps up to five daily checkpoints and three pre-restore checkpoints on this device. These help with mistakes but cannot recover a lost or reset device.
            </p>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">Your first daily checkpoint will be created automatically.</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {snapshot.reason === 'daily' ? 'Daily checkpoint' : 'Before restore'}
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
