import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

const CACHE_KEY = 'mnm_query_cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh across devices: refetch on focus/reconnect, invalidate on mutations.
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // retain for offline viewing
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: CACHE_KEY,
  throttleTime: 1000,
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: 1000 * 60 * 60 * 24, // show cached data up to 24h old when offline
  buster: 'v1',
  dehydrateOptions: {
    // Only persist successful reads; never persist pending/paused mutations.
    shouldDehydrateQuery: (q) => q.state.status === 'success',
  },
};

/** Remove all cached data (in-memory + persisted). Called on logout for data hygiene. */
export function clearPersistedCache() {
  queryClient.clear();
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
