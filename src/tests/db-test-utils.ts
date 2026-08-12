/**
 * Test helpers.
 *
 * Lets each Vitest file get a fresh in-memory Dexie
 * instance so tests don't share state.
 */

import { _resetDBForTests, getDB, DB_NAME } from '@db/database';

export function freshDB(name?: string) {
  const dbName = name ?? `test-${Math.random().toString(36).slice(2, 10)}`;
  _resetDBForTests();
  return getDB(dbName);
}

export async function wipeDB() {
  const db = getDB();
  await db.delete();
  _resetDBForTests();
}

export { DB_NAME };
