import * as React from 'react';
import { cn } from '@/lib/utils';

/** Horizontally scrollable on small screens so wide tables stay usable on phones. */
export function TableWrap({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('w-full overflow-x-auto rounded-lg border', className)} {...props} />;
}

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
  ),
);
Table.displayName = 'Table';

export const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('bg-muted/50 [&_tr]:border-b', className)} {...props} />
);

export const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);

export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-b transition-colors hover:bg-muted/40', className)} {...props} />
);

export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn('h-11 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)}
    {...props}
  />
);

export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-3 align-middle', className)} {...props} />
);
