import { useState } from 'react';
import { ShoppingBag, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pagination } from '@/components/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';
import { useOrders, useUpdateOrder, useCancelOrder } from '@/hooks/orders';
import { getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Order } from '@/types';

const STATUSES: Order['status'][] = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const customerName = (o: Order) => (typeof o.customer === 'object' && o.customer ? o.customer.name : '—');
const customerPhone = (o: Order) => (typeof o.customer === 'object' && o.customer ? o.customer.phone : undefined);

export default function Orders() {
  const { page, setPage, limit, setLimit } = usePagination();
  const { data, isLoading } = useOrders({ page, limit });
  const cancel = useCancelOrder();
  const [toCancel, setToCancel] = useState<Order | null>(null);

  const confirmCancel = async () => {
    if (!toCancel) return;
    try {
      await cancel.mutateAsync(toCancel._id);
      toast.success('Order cancelled, stock returned');
      setToCancel(null);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div>
      <PageHeader title="Online Orders" subtitle="Orders placed on your customer storefront." />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !data?.data.length ? (
        <EmptyState icon={ShoppingBag} title="No online orders yet" description="Orders from your /shop storefront will appear here." />
      ) : (
        <>
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Cancel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((o) => (
                  <TableRow key={o._id}>
                    <TableCell className="font-medium">{o.orderNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(o.placedAt || o.createdAt)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{customerName(o)}</div>
                      <div className="text-xs text-muted-foreground">{customerPhone(o) || o.shippingAddress?.phone}</div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="text-xs text-muted-foreground">
                        {o.items.map((i) => `${i.productName} (${i.color}/${i.size})×${i.quantity}`).join(', ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(o.total)}</TableCell>
                    <TableCell>
                      <Badge variant={o.paymentStatus === 'paid' ? 'success' : 'secondary'}>
                        {o.paymentMethod.toUpperCase()} · {o.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {o.status === 'cancelled' ? (
                        <Badge variant="destructive">cancelled</Badge>
                      ) : (
                        <OrderStatusSelect order={o} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {o.status !== 'cancelled' && o.status !== 'delivered' && (
                        <Button variant="ghost" size="icon" aria-label="Cancel" onClick={() => setToCancel(o)}>
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
        title={`Cancel ${toCancel?.orderNumber}?`}
        description="This returns the reserved stock to inventory."
        confirmLabel="Cancel order"
        destructive
        loading={cancel.isPending}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

function OrderStatusSelect({ order }: { order: Order }) {
  const update = useUpdateOrder(order._id);
  const change = async (status: string) => {
    try {
      // When marking delivered, also settle a COD payment.
      const body: { status: Order['status']; paymentStatus?: Order['paymentStatus'] } = { status: status as Order['status'] };
      if (status === 'delivered' && order.paymentStatus === 'pending') body.paymentStatus = 'paid';
      await update.mutateAsync(body);
      toast.success('Order updated');
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };
  return (
    <Select value={order.status} onValueChange={change}>
      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
      <SelectContent>
        {STATUSES.filter((s) => s !== 'cancelled').map((s) => (
          <SelectItem key={s} value={s}>{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
