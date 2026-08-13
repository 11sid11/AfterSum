import { validateBackup, type Backup } from '@/export/json/backup';

const SHEET_FORMAT = 'aftersum-sheet-backup-v1';
const CHUNK_SIZE = 30_000;

export function encodeBackupRows(backup: Backup): string[][] {
  const payload = JSON.stringify(backup);
  const chunks: string[] = [];
  for (let offset = 0; offset < payload.length; offset += CHUNK_SIZE) {
    chunks.push(payload.slice(offset, offset + CHUNK_SIZE));
  }

  return [
    ['format', SHEET_FORMAT],
    ['backupFormat', backup.format],
    ['schemaVersion', String(backup.schemaVersion)],
    ['exportedAt', backup.exportedAt],
    ['chunkCount', String(chunks.length)],
    ...chunks.map((chunk, index) => [`chunk:${index}`, chunk]),
  ];
}

export function decodeBackupRows(rows: unknown[][]): Backup {
  const values = new Map(
    rows
      .filter((row) => row.length >= 2)
      .map((row) => [String(row[0] ?? ''), String(row[1] ?? '')]),
  );

  if (values.get('format') !== SHEET_FORMAT) {
    throw new Error('This spreadsheet is not an AfterSum cloud backup.');
  }

  const chunkCount = Number(values.get('chunkCount'));
  if (!Number.isSafeInteger(chunkCount) || chunkCount < 1) {
    throw new Error('Cloud backup payload is incomplete.');
  }

  const chunks = Array.from({ length: chunkCount }, (_, index) => values.get(`chunk:${index}`));
  if (chunks.some((chunk) => chunk === undefined)) {
    throw new Error('Cloud backup payload is incomplete.');
  }

  try {
    return validateBackup(JSON.parse(chunks.join('')));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Cloud backup payload is corrupted.');
    throw error;
  }
}

export function readBackupMetadata(rows: unknown[][]): {
  exportedAt?: string;
  schemaVersion?: number;
} {
  const values = new Map(rows.map((row) => [String(row[0] ?? ''), String(row[1] ?? '')]));
  if (values.get('format') !== SHEET_FORMAT) return {};

  const schemaVersion = Number(values.get('schemaVersion'));
  return {
    exportedAt: values.get('exportedAt') || undefined,
    schemaVersion: Number.isSafeInteger(schemaVersion) ? schemaVersion : undefined,
  };
}
