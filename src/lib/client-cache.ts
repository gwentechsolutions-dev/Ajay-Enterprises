/**
 * INVENTRA ERP - Fast In-Memory Client-Side Cache
 * Eliminates skeleton loading delays and network round-trips during navigation.
 * Implements an in-memory Stale-While-Revalidate caching pattern for authenticated portal views.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Fetches data with in-memory caching.
 * If data exists in cache, returns it immediately (0ms).
 * If the cached data is older than ttlMs, it transparently revalidates in the background.
 */
export async function fetchWithClientCache<T = any>(
  url: string,
  options?: {
    ttlMs?: number;
    forceRefresh?: boolean;
    onBackgroundUpdate?: (freshData: T) => void;
  }
): Promise<T> {
  const ttl = options?.ttlMs ?? 30_000; // 30 seconds default
  const now = Date.now();
  const cached = memoryCache.get(url);

  if (cached && !options?.forceRefresh) {
    const isStale = now - cached.timestamp > ttl;
    if (isStale) {
      // Background revalidation
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.success) {
            memoryCache.set(url, { data: json.data, timestamp: Date.now() });
            options?.onBackgroundUpdate?.(json.data);
          }
        })
        .catch(() => {});
    }
    return cached.data as T;
  }

  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || `Request to ${url} failed`);
  }

  memoryCache.set(url, { data: json.data, timestamp: Date.now() });
  return json.data as T;
}

/**
 * Invalidate cache entries matching a URL prefix (e.g. after POST/PUT/DELETE mutations).
 */
export function invalidateClientCache(urlPrefix?: string) {
  if (!urlPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(urlPrefix)) {
      memoryCache.delete(key);
    }
  }
}
