import { useState } from 'react';
import { AlertTriangle, Cloud, CloudDownload, CloudUpload, ExternalLink, LogOut, RefreshCw } from 'lucide-react';
import { Button, Card, Spinner, useToast } from '@components/ui';
import { exportBackup, restoreBackup, summarizeBackup } from '@/export/json/backup';
import { settingsRepository } from '@shared/settings/repository';
import { useAppSettings } from '@shared/settings/useSettings';
import { markSynced, setSyncStatus } from '@sync/status';
import { useSyncStatus } from '@sync/status.queries';
import {
  clearGoogleAuthState,
  disconnectGoogleAuthorization,
  getGoogleAuthState,
  getGoogleSession,
  isGoogleAuthConfigured,
  requestGoogleAuthorization,
  type GoogleAuthState,
} from '@sync/google/auth';
import {
  assertGoogleAccount,
  ensureBackupSpreadsheet,
  findBackupSpreadsheet,
  getCloudBackupInfo,
  readCloudBackup,
  writeCloudBackup,
  type CloudBackupInfo,
} from '@sync/google/sheets';

export function GoogleSheetsBackupCard() {
  const settings = useAppSettings();
  const sync = useSyncStatus();
  const toast = useToast();
  const [auth, setAuth] = useState<GoogleAuthState>(() => getGoogleAuthState());
  const [cloud, setCloud] = useState<CloudBackupInfo | null | undefined>(undefined);
  const [pendingAccount, setPendingAccount] = useState<GoogleAuthState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!settings) {
    return (
      <Card>
        <Spinner />
      </Card>
    );
  }

  if (!isGoogleAuthConfigured()) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <Cloud size={20} className="mt-0.5 text-slate-400" />
          <div>
            <h2 className="text-sm font-semibold">Google Sheets backup</h2>
            <p className="mt-1 text-xs text-slate-500">
              Optional cloud backup is not configured for this build. AfterSum remains fully usable offline.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const session = getGoogleSession();
  const authorizedForBoundAccount =
    !!session && !!settings.googleAccountId && session.accountId === settings.googleAccountId;

  const connect = async () => {
    setBusy('connect');
    try {
      const nextAuth = await requestGoogleAuthorization({ prompt: 'select_account' });
      setAuth(nextAuth);
      if (!nextAuth.accountId) throw new Error('Google account identity was unavailable.');

      if (settings.googleAccountId && settings.googleAccountId !== nextAuth.accountId) {
        setPendingAccount(nextAuth);
        setCloud(undefined);
        return;
      }
      await bindAndDiscover(nextAuth);
    } catch (error) {
      toast.show(errorMessage(error), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const bindAndDiscover = async (nextAuth: GoogleAuthState, switching = false) => {
    const nextSession = getGoogleSession();
    if (!nextSession || !nextAuth.accountId) throw new Error('Google authorization expired. Reconnect and try again.');
    if (nextSession.accountId !== nextAuth.accountId) throw new Error('Google account changed during authorization.');

    const preferredId = !switching ? settings.googleSpreadsheetId : undefined;
    const found = await findBackupSpreadsheet(nextSession, preferredId);
    const info = found ? await getCloudBackupInfo(nextSession, found) : null;
    await settingsRepository.setGoogleSyncBinding({
      accountId: nextAuth.accountId,
      email: nextAuth.email,
      spreadsheetId: found?.spreadsheetId,
    });
    setCloud(info);
    setPendingAccount(null);
  };

  const confirmAccountSwitch = async () => {
    if (!pendingAccount?.accountId) return;
    setBusy('switch');
    try {
      await bindAndDiscover(pendingAccount, true);
      toast.show(`Google account switched to ${pendingAccount.email ?? 'the selected account'}. Local data was not changed.`);
    } catch (error) {
      toast.show(errorMessage(error), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const cancelAccountSwitch = () => {
    clearGoogleAuthState();
    setAuth(getGoogleAuthState());
    setPendingAccount(null);
  };

  const backupNow = async () => {
    const currentSession = getGoogleSession();
    if (!currentSession) {
      toast.show('Reconnect Google before backing up.', { variant: 'error' });
      return;
    }

    setBusy('backup');
    try {
      assertGoogleAccount(currentSession, settings.googleAccountId);
      await setSyncStatus('syncing');
      const backup = await exportBackup();
      const spreadsheet = await ensureBackupSpreadsheet(currentSession, settings.googleSpreadsheetId);
      await writeCloudBackup(currentSession, spreadsheet.spreadsheetId, backup);
      await settingsRepository.setGoogleSyncBinding({
        accountId: currentSession.accountId,
        email: currentSession.email,
        spreadsheetId: spreadsheet.spreadsheetId,
      });
      await markSynced();
      setCloud({ ...spreadsheet, exportedAt: backup.exportedAt, schemaVersion: backup.schemaVersion });
      toast.show('Google Sheets backup updated.');
    } catch (error) {
      await setSyncStatus('error', { lastError: errorMessage(error) });
      toast.show(errorMessage(error), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const restoreFromGoogle = async () => {
    const currentSession = getGoogleSession();
    if (!currentSession) {
      toast.show('Reconnect Google before restoring.', { variant: 'error' });
      return;
    }

    setBusy('restore-cloud');
    try {
      assertGoogleAccount(currentSession, settings.googleAccountId);
      const spreadsheet = await findBackupSpreadsheet(currentSession, settings.googleSpreadsheetId);
      if (!spreadsheet) throw new Error('No AfterSum backup was found in this Google account.');
      const backup = await readCloudBackup(currentSession, spreadsheet.spreadsheetId);
      const summary = summarizeBackup(backup);

      const confirmed = window.confirm(
        `Restore the Google Sheets backup from ${formatTimestamp(backup.exportedAt)}? This replaces local financial data. A safety JSON backup of this device will download first.`,
      );
      if (!confirmed) return;

      const safety = await exportBackup();
      downloadJson(safety, `aftersum-pre-cloud-restore-${new Date().toISOString().slice(0, 10)}.json`);
      await restoreBackup(backup);
      await settingsRepository.setGoogleSyncBinding({
        accountId: currentSession.accountId,
        email: currentSession.email,
        spreadsheetId: spreadsheet.spreadsheetId,
      });
      await markSynced();
      setCloud({ ...spreadsheet, exportedAt: backup.exportedAt, schemaVersion: backup.schemaVersion });
      toast.show(
        `Restored ${summary.people} people, ${summary.trackTransactions} Track, ${summary.splitExpenses} Split, and ${summary.lendEntries} Lend entries.`,
      );
    } catch (error) {
      await setSyncStatus('error', { lastError: errorMessage(error) });
      toast.show(errorMessage(error), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    const confirmed = window.confirm(
      'Disconnect Google Sheets backup from this device? Local data and the existing Google Sheet will not be deleted.',
    );
    if (!confirmed) return;

    setBusy('disconnect');
    try {
      await disconnectGoogleAuthorization();
      await settingsRepository.clearGoogleSyncBinding();
      setAuth(getGoogleAuthState());
      setCloud(undefined);
      setPendingAccount(null);
      toast.show('Google account disconnected. Local data was not changed.');
    } catch (error) {
      toast.show(errorMessage(error), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Cloud size={20} className="mt-0.5 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Google Sheets backup</h2>
            <p className="mt-1 text-xs text-slate-500">
              Optional manual backup. IndexedDB stays the source of truth; restore is always explicit.
            </p>
          </div>
        </div>
      </div>

      {pendingAccount ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-2">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium">Different Google account selected</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                This device is linked to {settings.googleAccountEmail ?? 'another Google account'}, but you selected{' '}
                {pendingAccount.email ?? 'a different account'}. Local data has not been changed.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={cancelAccountSwitch} disabled={!!busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void confirmAccountSwitch()} disabled={!!busy}>
              {busy === 'switch' ? <Spinner /> : null} Use selected account
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-1 text-xs text-slate-500">
            <p>
              Account:{' '}
              <strong className="font-medium text-slate-700 dark:text-slate-200">
                {settings.googleAccountEmail ?? (settings.googleSyncEnabled ? 'Linked Google account' : 'Not connected')}
              </strong>
            </p>
            {settings.googleSyncEnabled && (
              <p>Authorization: {authorizedForBoundAccount ? 'Connected for this session' : 'Reconnect required'}</p>
            )}
            {cloud === null && <p>Cloud backup: none found in this account</p>}
            {cloud?.exportedAt && <p>Cloud backup: {formatTimestamp(cloud.exportedAt)}</p>}
            {!cloud?.exportedAt && sync?.lastSuccessfulSyncAt && <p>Last backup: {formatTimestamp(sync.lastSuccessfulSyncAt)}</p>}
            {sync?.dirty && <p className="text-amber-600">Local changes are waiting to be backed up.</p>}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => void connect()} disabled={!!busy}>
              {busy === 'connect' ? <Spinner /> : <RefreshCw size={16} />}
              {settings.googleSyncEnabled ? 'Reconnect / switch account' : 'Connect Google'}
            </Button>
            <Button onClick={() => void backupNow()} disabled={!!busy || !authorizedForBoundAccount}>
              {busy === 'backup' ? <Spinner /> : <CloudUpload size={16} />} Back up now
            </Button>
            <Button
              variant="secondary"
              onClick={() => void restoreFromGoogle()}
              disabled={!!busy || !authorizedForBoundAccount || cloud === null}
            >
              {busy === 'restore-cloud' ? <Spinner /> : <CloudDownload size={16} />} Restore from Google
            </Button>
            {settings.googleSpreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(settings.googleSpreadsheetId)}/edit`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ExternalLink size={16} /> Open backup Sheet
              </a>
            )}
          </div>

          {settings.googleSyncEnabled && (
            <Button
              className="mt-3"
              size="sm"
              variant="secondary"
              onClick={() => void disconnect()}
              disabled={!!busy}
            >
              {busy === 'disconnect' ? <Spinner /> : <LogOut size={15} />} Disconnect Google
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
