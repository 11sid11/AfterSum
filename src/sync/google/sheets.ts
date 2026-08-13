import type { Backup } from '@/export/json/backup';
import type { GoogleSession } from './auth';
import { GoogleApiError, googleApiJson } from './api';
import { decodeBackupRows, encodeBackupRows, readBackupMetadata } from './backupCodec';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SHEETS_API = 'https://sheets.googleapis.com/v4';
const SPREADSHEET_NAME = 'AfterSum Backup';
const BACKUP_SHEET = 'Backup';
const APP_PROPERTY_KEY = 'aftersumBackup';
const APP_PROPERTY_VALUE = 'v1';

export interface CloudBackupInfo {
  spreadsheetId: string;
  name: string;
  modifiedTime?: string;
  exportedAt?: string;
  schemaVersion?: number;
}

interface DriveFile {
  id: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  appProperties?: Record<string, string>;
}

export function assertGoogleAccount(session: GoogleSession, expectedAccountId?: string): void {
  if (expectedAccountId && session.accountId !== expectedAccountId) {
    throw new Error('The authorized Google account does not match the account linked to this device.');
  }
}

export async function findBackupSpreadsheet(
  session: GoogleSession,
  preferredId?: string,
): Promise<CloudBackupInfo | null> {
  if (preferredId) {
    const preferred = await getDriveFile(session, preferredId).catch((error: unknown) => {
      if (error instanceof GoogleApiError && (error.status === 403 || error.status === 404)) return null;
      throw error;
    });
    if (preferred && isAfterSumSpreadsheet(preferred)) return toCloudInfo(preferred);
  }

  const params = new URLSearchParams({
    spaces: 'drive',
    pageSize: '10',
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,appProperties)',
    q: `mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and appProperties has { key='${APP_PROPERTY_KEY}' and value='${APP_PROPERTY_VALUE}' }`,
  });
  const result = await googleApiJson<{ files?: DriveFile[] }>(
    session,
    `${DRIVE_API}/files?${params.toString()}`,
  );
  const file = result.files?.find(isAfterSumSpreadsheet);
  return file ? toCloudInfo(file) : null;
}

export async function ensureBackupSpreadsheet(
  session: GoogleSession,
  preferredId?: string,
): Promise<CloudBackupInfo> {
  const existing = await findBackupSpreadsheet(session, preferredId);
  if (existing) return existing;

  const created = await googleApiJson<{ spreadsheetId?: string }>(session, `${SHEETS_API}/spreadsheets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: SPREADSHEET_NAME },
      sheets: [{ properties: { title: BACKUP_SHEET } }],
    }),
  });
  if (!created.spreadsheetId) throw new Error('Google Sheets did not return a spreadsheet ID.');

  await googleApiJson(session, `${DRIVE_API}/files/${encodeURIComponent(created.spreadsheetId)}?fields=id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appProperties: { [APP_PROPERTY_KEY]: APP_PROPERTY_VALUE } }),
  });

  return toCloudInfo(await getDriveFile(session, created.spreadsheetId));
}

export async function getCloudBackupInfo(
  session: GoogleSession,
  spreadsheet: CloudBackupInfo,
): Promise<CloudBackupInfo> {
  const rows = await readRows(session, spreadsheet.spreadsheetId, `${BACKUP_SHEET}!A1:B5`);
  return { ...spreadsheet, ...readBackupMetadata(rows) };
}

export async function writeCloudBackup(
  session: GoogleSession,
  spreadsheetId: string,
  backup: Backup,
): Promise<void> {
  await googleApiJson(session, valuesUrl(spreadsheetId, `${BACKUP_SHEET}!A:B`, 'clear'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  await googleApiJson(session, `${valuesUrl(spreadsheetId, `${BACKUP_SHEET}!A1`)}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      range: `${BACKUP_SHEET}!A1`,
      majorDimension: 'ROWS',
      values: encodeBackupRows(backup),
    }),
  });
}

export async function readCloudBackup(session: GoogleSession, spreadsheetId: string): Promise<Backup> {
  return decodeBackupRows(await readRows(session, spreadsheetId, `${BACKUP_SHEET}!A:B`));
}

async function getDriveFile(session: GoogleSession, fileId: string): Promise<DriveFile> {
  return googleApiJson<DriveFile>(
    session,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,appProperties`,
  );
}

function isAfterSumSpreadsheet(file: DriveFile): boolean {
  return (
    file.mimeType === 'application/vnd.google-apps.spreadsheet' &&
    file.appProperties?.[APP_PROPERTY_KEY] === APP_PROPERTY_VALUE
  );
}

function toCloudInfo(file: DriveFile): CloudBackupInfo {
  return {
    spreadsheetId: file.id,
    name: file.name || SPREADSHEET_NAME,
    modifiedTime: file.modifiedTime,
  };
}

async function readRows(session: GoogleSession, spreadsheetId: string, range: string): Promise<unknown[][]> {
  const response = await googleApiJson<{ values?: unknown[][] }>(session, valuesUrl(spreadsheetId, range));
  return response.values ?? [];
}

function valuesUrl(spreadsheetId: string, range: string, suffix = ''): string {
  const base = `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  return suffix ? `${base}:${suffix}` : base;
}
