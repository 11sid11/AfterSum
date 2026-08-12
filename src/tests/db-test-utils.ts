/**
 * Test helpers.
 *
 * Lets each Vitest file get a fresh in-memory Dexie
 * instance so tests don't share state.
 *
 * Tests use the default DB name (`finance-utility`) and
 * rely on fake-indexeddb for an in-memory store. After
 * every test the DB is wiped and the singleton is reset
 * so the next test starts clean.
 */

import { _resetDBForTests, getDB, DB_NAME } from '@db/database';

export function freshDB() {
  _resetDBForTests();
  return getDB(DB_NAME);
}

export async function wipeDB() {
  const db = getDB();
  try {
    await db.delete();
  } catch {
    // already gone
  }
  _resetDBForTests();
}

export { DB_NAME };
