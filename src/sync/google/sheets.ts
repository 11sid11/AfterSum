import type { Backup } from '@/export/json/backup';
import { decodeBackupRows, encodeBackupRows, readBackupMetadata } from '@/export/json/sheetBackup';
import {
  requireGoogleApiClient,
  type GoogleApiResponse,
  type GoogleSession,
} from './auth';

const SPREADSHEET_NAME = 'AfterSum Backup';
const BACKUP_SHEET = 'Backup';
const APP_PROPERTY_KEY = 'aftersumBackup';
const APP_PROPERTY_VALUE = 'v1';
const SHEETS_MIME_TYPE = 'application/vnd.google-apps.spreadsheet';

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

interface SpreadsheetCreateResult {
  spreadsheetId?: string;
}

interface ValuesResult {
  values?: unknown[][];
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
  assertGoogleAccount(session);
  const api = requireGoogleApiClient();

  if (preferredId) {
    try {
      const preferred = await getDriveFile(preferredId);
      if (isAfterSumSpreadsheet(preferred)) return toCloudInfo(preferred);
    } catch (error) {
      if (!isMissingOrForbidden(error)) throw error;
    }
  }

  const response = (await api.drive.files.list({
    spaces: 'drive',
    pageSize: 10,
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,appProperties)',
    q: `mimeType = '${SHEETS_MIME_TYPE}' and trashed = false and appProperties has { key='${APP_PROPERTY_KEY}' and value='${APP_PROPERTY_VALUE}' }`,
  })) as GoogleApiResponse<{ files?: DriveFile[] }>;

  const file = response.result.files?.find(isAfterSumSpreadsheet);
  return file ? toCloudInfo(file) : null;
}

export async function ensureBackupSpreadsheet(
  session: GoogleSession,
  preferredId?: string,
): Promise<CloudBackupInfo> {
  const existing = await findBackupSpreadsheet(session, preferredId);
  if (existing) return existing;

  const api = requireGoogleApiClient();
  const created = (await api.sheets.spreadsheets.create({
    properties: { title: SPREADSHEET_NAME },
    sheets: [{ properties: { title: BACKUP_SHEET } }],
  })) as GoogleApiResponse<SpreadsheetCreateResult>;

  const spreadsheetId = created.result.spreadsheetId;
  if (!spreadsheetId) throw new Error('Google Sheets did not return a spreadsheet ID.');

  await api.drive.files.update({
    fileId: spreadsheetId,
    fields: 'id,name,mimeType,modifiedTime,appProperties',
    resource: {
      appProperties: {
        [APP_PROPERTY_KEY]: APP_PROPERTY_VALUE,
      },
    },
  });

  return toCloudInfo(await getDriveFile(spreadsheetId));
}

export async function getCloudBackupInfo(
  session: GoogleSession,
  spreadsheet: CloudBackupInfo,
): Promise<CloudBackupInfo> {
  assertGoogleAccount(session);
  const rows = await readRows(spreadsheet.spreadsheetId, `${BACKUP_SHEET}!A1:B5`);
  return { ...spreadsheet, ...readBackupMetadata(rows) };
}

export async function writeCloudBackup(
  session: GoogleSession,
  spreadsheetId: string,
  backup: Backup,
): Promise<void> {
  assertGoogleAccount(session);
  const api = requireGoogleApiClient();

  await api.sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${BACKUP_SHEET}!A:B`,
  });

  await api.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${BACKUP_SHEET}!A1`,
    valueInputOption: 'RAW',
    resource: {
      majorDimension: 'ROWS',
      values: encodeBackupRows(backup),
    },
  });
}

export async function readCloudBackup(
  session: GoogleSession,
  spreadsheetId: string,
): Promise<Backup> {
  assertGoogleAccount(session);
  return decodeBackupRows(await readRows(spreadsheetId, `${BACKUP_SHEET}!A:B`));
}

async function getDriveFile(fileId: string): Promise<DriveFile> {
  const api = requireGoogleApiClient();
  const response = (await api.drive.files.get({
    fileId,
    fields: 'id,name,mimeType,modifiedTime,appProperties',
  })) as GoogleApiResponse<DriveFile>;
  return response.result;
}

async function readRows(spreadsheetId: string, range: string): Promise<unknown[][]> {
  const api = requireGoogleApiClient();
  const response = (await api.sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  })) as GoogleApiResponse<ValuesResult>;
  return response.result.values ?? [];
}

function isAfterSumSpreadsheet(file: DriveFile): boolean {
  return (
    file.mimeType === SHEETS_MIME_TYPE &&
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

function isMissingOrForbidden(error: unknown): boolean {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  return status === 403 || status === 404;
}
