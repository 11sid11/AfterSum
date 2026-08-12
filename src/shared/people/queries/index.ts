/**
 * Person queries.
 *
 * Live-query helpers that surface reactive data for React
 * components. Backed by Dexie so they update automatically
 * after any write.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@db/database';
import { findSelf } from '../domain';
import type { Person } from '@db/schema';

/** All active people, sorted (self first). */
export function usePeople(): Person[] | undefined {
  return useLiveQuery(async () => {
    const all = await getDB().people.toArray();
    return all
      .filter((p) => !p.deletedAt)
      .sort((a, b) => {
        if (a.isSelf && !b.isSelf) return -1;
        if (b.isSelf && !a.isSelf) return 1;
        return a.name.localeCompare(b.name);
      });
  }, []);
}

/** Single self person. */
export function useSelf(): Person | undefined {
  return useLiveQuery(async () => {
    const all = await getDB().people.toArray();
    return findSelf(all);
  }, []);
}

/** Get a person by id. */
export function usePerson(id: string | undefined): Person | undefined {
  return useLiveQuery(
    async () => (id ? getDB().people.get(id) : undefined),
    [id],
  );
}

/** Resolve a list of person ids to a name -> personId map. */
export function usePersonNameMap(): Map<string, string> | undefined {
  return useLiveQuery(async () => {
    const all = await getDB().people.toArray();
    const map = new Map<string, string>();
    for (const p of all) {
      if (!p.deletedAt) map.set(p.id, p.name);
    }
    return map;
  }, []);
}
