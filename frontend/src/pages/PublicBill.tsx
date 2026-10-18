import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, AlertCircle } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/ui/spinner';
import { formatCurrency, formatDate } from '@/lib/format';
import type { PublicInvoice } from '@/types';

export default function PublicBill() {
  const { token } = useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public-bill', token],
    queryFn: async () => (await api.get(`/public/invoices/${token}`)).data.data as PublicInvoice,
    retry: false,
  });

  if (isLoading) return <LoadingScreen label="Loading your invoice…" />;

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h1 className="mt-3 text-lg font-semibold">Invoice unavailable</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{getApiError(error).message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6">
      <div className="mx-auto max-w-2xl px-4">
        {/* Shop header */}
        <div className="overflow-hidden rounded-t-2xl shadow-sm">
          <div className="h-1.5 bg-gold" />
          <div className="bg-primary p-6 text-primary-foreground">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight">{data.shop.name}</h1>
                {data.shop.address && <p className="mt-1 text-sm opacity-90">{data.shop.address}</p>}
                {data.shop.phone && <p className="text-sm opacity-90">{data.shop.phone}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs opacity-80">Invoice</p>
                <p className="font-display text-xl font-semibold">{data.invoiceNumber}</p>
                <p className="text-xs opacity-90">{formatDate(data.date)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-b-2xl bg-card p-6 shadow-sm">
          {data.status === 'cancelled' && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
              This invoice has been cancelled.
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Billed to</p>
              <p className="font-medium">{data.customerName}</p>
            </div>
            <Badge variant={data.paymentStatus === 'paid' ? 'success' : data.paymentStatus === 'partial' ? 'warning' : 'destructive'}>
              {data.paymentStatus}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="py-2">Item</th>
                  <th className="py-2">Variant</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">
                      <span className="font-medium">{it.designNumber}</span>
                      <span className="block text-xs text-muted-foreground">{it.productName}</span>
                    </td>
                    <td className="py-2 text-muted-foreground">{it.color} / {it.size}</td>
                    <td className="py-2 text-right">{it.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(it.price)}</td>
                    <td className="py-2 text-right">{formatCurrency(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(data.subtotal)}</span></div>
            {data.discountAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>- {formatCurrency(data.discountAmount)}</span></div>}
            {data.taxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax ({data.taxPercent}%)</span><span>{formatCurrency(data.taxAmount)}</span></div>}
            <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{formatCurrency(data.total)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Paid</span><span>{formatCurrency(data.amountPaid)}</span></div>
            {data.balance > 0 && <div className="flex justify-between font-semibold"><span>Balance due</span><span>{formatCurrency(data.balance)}</span></div>}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button asChild>
              <a href={data.pdfUrl} target="_blank" rel="noopener noreferrer"><FileText className="h-4 w-4" /> View PDF</a>
            </Button>
            <Button asChild variant="outline">
              <a href={`${data.pdfUrl}?download=1`}><Download className="h-4 w-4" /> Download</a>
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">Powered by {data.shop.name}</p>
      </div>
    </div>
  );
}
