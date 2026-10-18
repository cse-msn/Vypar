import { useCallback, useState } from 'react';

/**
 * Standard list-pagination state shared by every list page.
 *
 * - `limit` defaults to 10 rows/page (the product-wide default the shop expects).
 * - Changing the page size snaps back to page 1 so you never land on an out-of-range page.
 * - `reset()` returns to page 1 — call it whenever a search/filter changes.
 */
export function usePagination(initialLimit = 10) {
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(initialLimit);

  const setLimit = useCallback((n: number) => {
    setLimitState(n);
    setPage(1);
  }, []);

  const reset = useCallback(() => setPage(1), []);

  return { page, setPage, limit, setLimit, reset };
}
