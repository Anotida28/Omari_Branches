const TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ENTRIES = 500;

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

// Map preserves insertion order — oldest entries are first, newest last.
// On access we delete + re-insert to move the entry to the end (LRU touch).
const store = new Map<string, CacheEntry>();

function evict(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.expiresAt) {
      store.delete(key);
    }
  }
  // If still over the limit after removing expired entries, drop the oldest.
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
}

export async function walletCached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    // Touch: move to end so LRU order stays accurate.
    store.delete(key);
    store.set(key, entry);
    return entry.data as T;
  }

  if (store.size >= MAX_ENTRIES) {
    evict();
  }

  const data = await fn();
  store.set(key, { data, expiresAt: Date.now() + TTL_MS });
  return data;
}
