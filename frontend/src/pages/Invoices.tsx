import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ReceiptText, Eye, Share2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ShareInvoiceDialog } from '@/components/ShareInvoiceDialog';
import { Pagination } from '@/components/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';
import { useInvoices, type InvoiceListParams } from '@/hooks/invoices';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Invoice } from '@/types';

const payVariant = (s: Invoice['paymentStatus']) => (s === 'paid' ? 'success' : s === 'partial' ? 'warning' : 'destructive');

export default function Invoices() {
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<InvoiceListParams['paymentStatus'] | ''>('');
  const [status, setStatus] = useState<InvoiceListParams['status'] | ''>('');
  const { page, setPage, limit, setLimit, reset } = usePagination();
  const { data, isLoading } = useInvoices({
    search: search || undefined,
    paymentStatus: paymentStatus || undefined,
    status: status || undefined,
    page,
    limit,
  });
  const [share, setShare] = useState<{ id: string; number: string } | null>(null);

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="All bills and their payment status."
        actions={<Button asChild><Link to="/billing"><Plus className="h-4 w-4" /> New Bill</Link></Button>}
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invoice no, customer…" value={search} onChange={(e) => { setSearch(e.target.value); reset(); }} className="pl-9" />
        </div>
        <Select value={paymentStatus || 'all'} onValueChange={(v) => { setPaymentStatus(v === 'all' ? '' : (v as any)); reset(); }}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : (v as any)); reset(); }}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !data?.data.length ? (
        <EmptyState icon={ReceiptText} title="No invoices found" description="Try clearing filters or create a new bill." />
      ) : (
        <>
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((inv) => (
                  <TableRow key={inv._id}>
                    <TableCell className="font-medium">
                      <Link to={`/invoices/${inv._id}`} className="hover:text-primary">{inv.invoiceNumber}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(inv.date)}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{inv.customerSnapshot.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.total)}</TableCell>
                    <TableCell className="text-right">{inv.balance > 0 ? formatCurrency(inv.balance) : '—'}</TableCell>
                    <TableCell>
                      {inv.status === 'cancelled' ? (
                        <Badge variant="destructive">cancelled</Badge>
                      ) : (
                        <Badge variant={payVariant(inv.paymentStatus)}>{inv.paymentStatus}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" aria-label="View">
                          <Link to={`/invoices/${inv._id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        {inv.status === 'confirmed' && (
                          <Button variant="ghost" size="icon" aria-label="Share" onClick={() => setShare({ id: inv._id, number: inv.invoiceNumber })}>
                            <Share2 className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>

          <Pagination meta={data.meta} onPageChange={setPage} onLimitChange={setLimit} />
        </>
      )}

      {share && (
        <ShareInvoiceDialog invoiceId={share.id} invoiceNumber={share.number} open={!!share} onOpenChange={(v) => !v && setShare(null)} />
      )}
    </div>
  );
}
