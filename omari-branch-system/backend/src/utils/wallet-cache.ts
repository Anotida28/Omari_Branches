const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export async function walletCached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data as T;
  }
  const data = await fn();
  store.set(key, { data, expiresAt: Date.now() + TTL_MS });
  return data;
}
