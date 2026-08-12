/**
 * ID generation.
 *
 * Prefers crypto.randomUUID where available, falls back to a
 * timestamp + random combo. All ids are short strings suitable
 * for use as Dexie primary keys.
 */

const hasCryptoUUID =
  typeof globalThis.crypto !== 'undefined' &&
  typeof globalThis.crypto.randomUUID === 'function';

/**
 * Generate a new opaque id.
 *
 * Uses UUIDv4 when available; otherwise falls back to a
 * timestamp + 6 random base36 characters. Output is always a
 * string with no whitespace and is safe to use as a Dexie
 * primary key.
 */
export function newId(): string {
  if (hasCryptoUUID) {
    return globalThis.crypto.randomUUID();
  }
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}_${r}`;
}

/**
 * Generate a prefixed id, e.g. `exp_xxxxxxxx` or `grp_xxxxxxxx`.
 * Useful for debugging CSV exports and logs.
 */
export function prefixedId(prefix: string): string {
  return `${prefix}_${newId().replace(/-/g, '').slice(0, 12)}`;
}
