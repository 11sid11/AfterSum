/**
 * Persistent storage helper.
 *
 * Calls `navigator.storage.persist()` when available. The
 * browser decides whether to grant persistence; we report
 * the actual state back to the UI.
 */

export interface PersistentStorageResult {
  requested: boolean;
  persisted: boolean;
  supported: boolean;
}

export async function persistBrowserStorage(): Promise<PersistentStorageResult> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { requested: false, persisted: false, supported: false };
  }
  try {
    if (typeof navigator.storage.persist === 'function') {
      const persisted = await navigator.storage.persist();
      return { requested: true, persisted, supported: true };
    }
  } catch {
    return { requested: false, persisted: false, supported: true };
  }
  return { requested: false, persisted: false, supported: true };
}

export async function isPersisted(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.persisted !== 'function') {
    return false;
  }
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.estimate !== 'function') {
    return null;
  }
  try {
    return await navigator.storage.estimate();
  } catch {
    return null;
  }
}
