import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types';

/** Rows-per-page choices offered on every list. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

type Meta = Paginated<unknown>['meta'];

interface PaginationProps {
  meta: Meta;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
}

/**
 * Shared pagination bar: First · Prev · numbered pages · Next · Last, plus a
 * rows-per-page selector and an "X–Y of N" count. Server-side paginated — it only
 * emits page/limit changes; the page's query hook fetches the matching slice.
 */
export function Pagination({
  meta,
  onPageChange,
  onLimitChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
}: PaginationProps) {
  const { total, page, limit, pages } = meta;

  // Self-heal: if the requested page falls past the last page (e.g. the page size
  // grew, a filter narrowed results, or rows were deleted), jump to the last page.
  useEffect(() => {
    if (page > pages) onPageChange(pages);
  }, [page, pages, onPageChange]);

  const current = Math.min(page, pages);
  const firstRow = total === 0 ? 0 : (current - 1) * limit + 1;
  const lastRow = Math.min(current * limit, total);
  const atStart = current <= 1;
  const atEnd = current >= pages;

  return (
    <div
      className={cn(
        'mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {/* Count + rows-per-page */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {total === 0 ? (
            'No results'
          ) : (
            <>
              Showing{' '}
              <span className="font-medium text-foreground">
                {firstRow}–{lastRow}
              </span>{' '}
              of {total}
            </>
          )}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="hidden sm:inline">Rows</span>
          <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
            <SelectTrigger aria-label="Rows per page" className="h-9 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          aria-label="Go to first page"
          disabled={atStart}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          aria-label="Previous page"
          disabled={atStart}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Numbered pages (desktop) */}
        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(current, pages).map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e${i}`} className="px-1.5 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === current ? 'default' : 'outline'}
                size="sm"
                className="h-9 min-w-9 px-2"
                aria-label={`Page ${p}`}
                aria-current={p === current ? 'page' : undefined}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ),
          )}
        </div>

        {/* Compact indicator (mobile) */}
        <span className="px-2 text-sm text-muted-foreground sm:hidden">
          Page {current} / {pages}
        </span>

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          aria-label="Next page"
          disabled={atEnd}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          aria-label="Go to last page"
          disabled={atEnd}
          onClick={() => onPageChange(pages)}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Build a windowed page list with ellipses, e.g. [1, '…', 4, 5, 6, '…', 20]. */
function pageWindow(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 1) return [1];
  const delta = 1; // neighbours shown on each side of the current page
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);
  const out: (number | 'ellipsis')[] = [1];
  if (left > 2) out.push('ellipsis');
  for (let i = left; i <= right; i++) out.push(i);
  if (right < total - 1) out.push('ellipsis');
  out.push(total);
  return out;
}
