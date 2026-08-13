import Dexie, { type Table } from 'dexie';
import { exportBackup, restoreBackup, validateBackup, type Backup } from '@/export/json/backup';
import { newId } from '@shared/ids';
import { toDateOnly } from '@shared/dates';
import type { RecoverySnapshot, RecoverySnapshotReason } from '@db/schema';

const RECOVERY_DB_NAME = 'aftersum-recovery';
const DAILY_RETENTION = 5;
const PRE_RESTORE_RETENTION = 3;

class RecoveryDB extends Dexie {
  snapshots!: Table<RecoverySnapshot, string>;

  constructor() {
    super(RECOVERY_DB_NAME);
    this.version(1).stores({ snapshots: 'id, createdAt, reason' });
  }
}

let recoveryDb: RecoveryDB | null = null;

function getRecoveryDB(): RecoveryDB {
  recoveryDb ??= new RecoveryDB();
  return recoveryDb;
}

export async function listRecoverySnapshots(): Promise<RecoverySnapshot[]> {
  return getRecoveryDB().snapshots.orderBy('createdAt').reverse().toArray();
}

export async function ensureDailyRecoverySnapshot(now: Date = new Date()): Promise<void> {
  const today = toDateOnly(now);
  const existing = await getRecoveryDB().snapshots.where('reason').equals('daily').toArray();
  if (existing.some((snapshot) => toDateOnly(new Date(snapshot.createdAt)) === today)) return;
  await createRecoverySnapshot('daily', now);
}

export async function createRecoverySnapshot(
  reason: RecoverySnapshotReason,
  now: Date = new Date(),
): Promise<RecoverySnapshot> {
  const backup = await exportBackup();
  const snapshot: RecoverySnapshot = {
    id: newId(),
    createdAt: now.toISOString(),
    reason,
    payload: JSON.stringify(backup),
  };
  await getRecoveryDB().snapshots.put(snapshot);
  await pruneSnapshots();
  return snapshot;
}

export async function restoreRecoverySnapshot(id: string): Promise<Backup> {
  const snapshot = await getRecoveryDB().snapshots.get(id);
  if (!snapshot) throw new Error('Recovery checkpoint no longer exists.');

  const backup = parseRecoveryPayload(snapshot.payload);
  await createRecoverySnapshot('before_restore');
  await restoreBackup(backup);
  return backup;
}

function parseRecoveryPayload(payload: string): Backup {
  try {
    return validateBackup(JSON.parse(payload));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Recovery checkpoint is corrupted.');
    throw error;
  }
}

async function pruneSnapshots(): Promise<void> {
  const snapshots = await listRecoverySnapshots();
  const keep = new Set<string>();

  for (const reason of ['daily', 'before_restore'] as const) {
    const limit = reason === 'daily' ? DAILY_RETENTION : PRE_RESTORE_RETENTION;
    snapshots
      .filter((snapshot) => snapshot.reason === reason)
      .slice(0, limit)
      .forEach((snapshot) => keep.add(snapshot.id));
  }

  const expired = snapshots.filter((snapshot) => !keep.has(snapshot.id));
  if (expired.length) {
    await getRecoveryDB().snapshots.bulkDelete(expired.map((snapshot) => snapshot.id));
  }
}

export async function _resetRecoveryDBForTests(): Promise<void> {
  if (recoveryDb) {
    recoveryDb.close();
    recoveryDb = null;
  }
  await Dexie.delete(RECOVERY_DB_NAME);
}
