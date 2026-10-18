import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Truck, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pagination } from '@/components/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';
import { usePurchases, useCancelPurchase } from '@/hooks/purchases';
import { getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Purchase } from '@/types';

const supplierName = (p: Purchase) => (typeof p.supplier === 'object' && p.supplier ? p.supplier.name : '—');

export default function Purchases() {
  const { page, setPage, limit, setLimit } = usePagination();
  const { data, isLoading } = usePurchases({ page, limit });
  const cancel = useCancelPurchase();
  const [toCancel, setToCancel] = useState<Purchase | null>(null);

  const confirmCancel = async () => {
    if (!toCancel) return;
    try {
      await cancel.mutateAsync(toCancel._id);
      toast.success('Purchase cancelled and stock reversed');
      setToCancel(null);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Stock received from suppliers."
        actions={<Button asChild><Link to="/purchases/new"><Plus className="h-4 w-4" /> New purchase</Link></Button>}
      />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !data?.data.length ? (
        <EmptyState
          icon={Truck}
          title="No purchases yet"
          description="Record stock you receive from suppliers."
          action={<Button asChild><Link to="/purchases/new"><Plus className="h-4 w-4" /> New purchase</Link></Button>}
        />
      ) : (
        <>
        <TableWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purchase #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((p) => (
                <TableRow key={p._id}>
                  <TableCell className="font-medium">{p.purchaseNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.date)}</TableCell>
                  <TableCell>{supplierName(p)}</TableCell>
                  <TableCell className="text-right">{p.items.length}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.total)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'received' ? 'success' : 'destructive'}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {p.status === 'received' && (
                      <Button variant="ghost" size="icon" aria-label="Cancel" onClick={() => setToCancel(p)}>
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        <Pagination meta={data.meta} onPageChange={setPage} onLimitChange={setLimit} />
        </>
      )}

      <ConfirmDialog
        open={!!toCancel}
        onOpenChange={(v) => !v && setToCancel(null)}
        title={`Cancel ${toCancel?.purchaseNumber}?`}
        description="This reverses the received stock. It will fail if those items have already been sold."
        confirmLabel="Cancel purchase"
        destructive
        loading={cancel.isPending}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
