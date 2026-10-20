import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { CustomerPicker } from '@/components/CustomerPicker';
import { RecordPaymentDialog } from '@/components/RecordPaymentDialog';
import { Pagination } from '@/components/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';
import { usePayments } from '@/hooks/payments';
import { formatCurrency, formatDate, paymentMethodLabel } from '@/lib/format';
import type { Customer, Payment } from '@/types';

const custName = (p: Payment) => (typeof p.customer === 'object' && p.customer ? p.customer.name : '—');
const invNo = (p: Payment) => (p.invoice && typeof p.invoice === 'object' ? p.invoice.invoiceNumber : undefined);

export default function Payments() {
  const { page, setPage, limit, setLimit } = usePagination();
  const { data, isLoading } = usePayments({ page, limit });
  const [selected, setSelected] = useState<Customer | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  // Opening the record dialog as soon as a customer is chosen.
  useEffect(() => {
    if (selected) setPayOpen(true);
  }, [selected]);

  return (
    <div>
      <PageHeader title="Payments" subtitle="Record and review customer receipts." />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="text-base">Record a payment</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerPicker value={selected} onChange={setSelected} allowWalkIn={false} />
          <p className="mt-2 text-xs text-muted-foreground">Select a customer to record a receipt against their dues.</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !data?.data.length ? (
        <EmptyState icon={Wallet} title="No payments yet" description="Recorded receipts will appear here." />
      ) : (
        <>
        <TableWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Against</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((p) => (
                <TableRow key={p._id}>
                  <TableCell className="font-medium">{p.paymentNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.date)}</TableCell>
                  <TableCell>{custName(p)}</TableCell>
                  <TableCell className="text-muted-foreground">{invNo(p) ?? 'On account'}</TableCell>
                  <TableCell><Badge variant="secondary">{paymentMethodLabel(p.method)}</Badge></TableCell>
                  <TableCell className="text-right font-semibold text-success">{formatCurrency(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        <Pagination meta={data.meta} onPageChange={setPage} onLimitChange={setLimit} />
        </>
      )}

      {selected && (
        <RecordPaymentDialog
          open={payOpen}
          onOpenChange={(v) => {
            setPayOpen(v);
            if (!v) setSelected(null);
          }}
          customer={selected}
        />
      )}
    </div>
  );
}
