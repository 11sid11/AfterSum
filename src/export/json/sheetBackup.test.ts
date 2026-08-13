import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, type Backup } from './backup';
import { SCHEMA_VERSION } from '@app/constants';
import { decodeBackupRows, encodeBackupRows, readBackupMetadata } from './sheetBackup';

const backup: Backup = {
  format: BACKUP_FORMAT,
  schemaVersion: SCHEMA_VERSION,
  exportedAt: '2026-08-13T12:00:00.000Z',
  appVersion: 'test',
  shared: { people: [] },
  track: { transactions: [], categories: [], budgets: [], recurringRules: [] },
  split: { groups: [], members: [], expenses: [], payers: [], shares: [], settlements: [] },
  lend: { ledgers: [], entries: [] },
};

describe('sheet backup codec', () => {
  it('round-trips a valid backup', () => {
    expect(decodeBackupRows(encodeBackupRows(backup))).toEqual(backup);
  });

  it('reads backup metadata without decoding the payload', () => {
    expect(readBackupMetadata(encodeBackupRows(backup).slice(0, 5))).toEqual({
      exportedAt: backup.exportedAt,
      schemaVersion: backup.schemaVersion,
    });
  });

  it('rejects an incomplete payload', () => {
    const rows = encodeBackupRows(backup).filter(([key]) => key !== 'chunk:0');
    expect(() => decodeBackupRows(rows)).toThrow('incomplete');
  });
});
