/**
 * Transaction helper.
 *
 * Wraps Dexie's `transaction` with proper typing. Use this for
 * any write that spans multiple tables (e.g. atomic Split
 * expense creation) so all writes either commit or roll back
 * together.
 */

import { getDB } from './database';
import type { FinanceDB } from './database';
import type { Table } from 'dexie';

export type DBMode = 'readonly' | 'readwrite';

/**
 * Run a function inside a Dexie transaction.
 *
 * The callback receives a strongly-typed map of table names to
 * Dexie Table instances, so the caller doesn't have to cast.
 */
export async function runTransaction<T>(
  tables: string[],
  mode: DBMode,
  fn: (tx: { db: FinanceDB; tables: Record<string, Table> }) => Promise<T>,
): Promise<T> {
  const db = getDB();
  // Dexie's TS overloads want a list of Table<T, K>; we accept
  // string table names for ergonomics and resolve them at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableInstances: any[] = tables.map((t) => (db as any)[t]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.transaction(mode as any, tableInstances, async () => {
    return fn({
      db,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tables: Object.fromEntries(tables.map((t) => [t, (db as any)[t]])),
    });
  });
}
