/**
 * Browser storage helpers.
 *
 * AfterSum uses IndexedDB for its operational data and the service worker cache
 * for the offline app shell. Browser storage APIs report origin-level usage and
 * persistence guarantees; the browser remains responsible for granting quota
 * and persistent-storage requests.
 */

export interface PersistentStorageResult {
  requested: boolean;
  persisted: boolean;
  supported: boolean;
}

export interface BrowserStorageInfo {
  storageSupported: boolean;
  persistenceSupported: boolean;
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function persistBrowserStorage(): Promise<PersistentStorageResult> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.persist !== 'function'
  ) {
    return { requested: false, persisted: false, supported: false };
  }

  try {
    const persisted = await navigator.storage.persist();
    return { requested: true, persisted, supported: true };
  } catch {
    return { requested: true, persisted: false, supported: true };
  }
}

export async function isPersisted(): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.persisted !== 'function'
  ) {
    return false;
  }

  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<StorageEstimate | null> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== 'function'
  ) {
    return null;
  }

  try {
    return await navigator.storage.estimate();
  } catch {
    return null;
  }
}

export async function getBrowserStorageInfo(): Promise<BrowserStorageInfo> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return {
      storageSupported: false,
      persistenceSupported: false,
      persisted: null,
      usageBytes: null,
      quotaBytes: null,
    };
  }

  const persistenceSupported =
    typeof navigator.storage.persist === 'function' &&
    typeof navigator.storage.persisted === 'function';

  const [persisted, estimate] = await Promise.all([
    persistenceSupported ? isPersisted() : Promise.resolve(null),
    storageEstimate(),
  ]);

  return {
    storageSupported: true,
    persistenceSupported,
    persisted,
    usageBytes: typeof estimate?.usage === 'number' ? estimate.usage : null,
    quotaBytes: typeof estimate?.quota === 'number' ? estimate.quota : null,
  };
}
