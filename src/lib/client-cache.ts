/**
 * INVENTRA ERP - Fast Client-Side Multi-Tier Cache (L1 Memory + L2 SessionStorage)
 * Eliminates skeleton loading delays and network round-trips during navigation.
 * Implements an instant Stale-While-Revalidate caching pattern for authenticated portal views.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

function getSessionStorageCache<T>(key: string): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`inventra_cache_${key}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setSessionStorageCache<T>(key: string, entry: CacheEntry<T>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`inventra_cache_${key}`, JSON.stringify(entry));
  } catch {
    // Ignore quota or disabled storage
  }
}

function removeSessionStorageCache(prefix?: string) {
  if (typeof window === "undefined") return;
  try {
    if (!prefix) {
      const keys = Object.keys(sessionStorage).filter((k) => k.startsWith("inventra_cache_"));
      keys.forEach((k) => sessionStorage.removeItem(k));
    } else {
      const target = `inventra_cache_${prefix}`;
      const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(target));
      keys.forEach((k) => sessionStorage.removeItem(k));
    }
  } catch {
    // Ignore
  }
}

/**
 * Fetches data with instant multi-tier caching.
 * If data exists in memory or sessionStorage, returns it immediately (0ms).
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
  const ttl = options?.ttlMs ?? 60_000; // 60 seconds default
  const now = Date.now();

  // 1. Check L1 Memory Cache
  let cached = memoryCache.get(url);

  // 2. Fall back to L2 SessionStorage Cache (instant on page reload or nav)
  if (!cached) {
    const ss = getSessionStorageCache<T>(url);
    if (ss) {
      cached = ss;
      memoryCache.set(url, ss);
    }
  }

  if (cached && !options?.forceRefresh) {
    const isStale = now - cached.timestamp > ttl;
    if (isStale) {
      // Transparent background revalidation (bypasses browser HTTP cache)
      const bustUrl = `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`;
      fetch(bustUrl, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.success) {
            const freshEntry = { data: json.data, timestamp: Date.now() };
            memoryCache.set(url, freshEntry);
            setSessionStorageCache(url, freshEntry);
            options?.onBackgroundUpdate?.(json.data);
          }
        })
        .catch(() => {});
    }
    return cached.data as T;
  }

  // Network fetch: always use no-store and bust cache when forceRefresh is requested
  const fetchUrl = options?.forceRefresh
    ? `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`
    : url;
  const res = await fetch(fetchUrl, {
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || `Request to ${url} failed`);
  }

  const newEntry = { data: json.data, timestamp: Date.now() };
  memoryCache.set(url, newEntry);
  setSessionStorageCache(url, newEntry);
  return json.data as T;
}

/**
 * Invalidate cache entries matching a URL prefix (e.g. after POST/PUT/DELETE mutations).
 */
export function invalidateClientCache(urlPrefix?: string) {
  if (!urlPrefix) {
    memoryCache.clear();
    removeSessionStorageCache();
    return;
  }
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(urlPrefix)) {
      memoryCache.delete(key);
    }
  }
  removeSessionStorageCache(urlPrefix);
}
