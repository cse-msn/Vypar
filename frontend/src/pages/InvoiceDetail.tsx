import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Download, Share2, Ban, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { ShareInvoiceDialog } from '@/components/ShareInvoiceDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RecordPaymentDialog } from '@/components/RecordPaymentDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';
import { useInvoice, useCancelInvoice } from '@/hooks/invoices';
import { openInvoicePdf } from '@/lib/pdf';
import { getApiError } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { Customer } from '@/types';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: inv, isLoading } = useInvoice(id);
  const cancel = useCancelInvoice();
  const [shareOpen, setShareOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  if (isLoading || !inv) return <LoadingScreen />;

  const customer = inv.customer && typeof inv.customer === 'object' ? (inv.customer as Customer) : null;
  const cancelled = inv.status === 'cancelled';

  const doCancel = async () => {
    try {
      await cancel.mutateAsync({ id: inv._id });
      toast.success('Invoice cancelled and stock restored');
      setCancelOpen(false);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div>
      <PageHeader
        title={inv.invoiceNumber}
        subtitle={formatDateTime(inv.date)}
        actions={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /> Back</Button>}
      />

      {cancelled && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
          This invoice has been cancelled and its stock was restored.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Design</TableHead>
                    <TableHead>Colour / Size</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.items.map((it, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <span className="font-medium">{it.designNumber}</span>
                        <span className="block text-xs text-muted-foreground">{it.productName}</span>
                      </TableCell>
                      <TableCell>{it.color} / {it.size}</TableCell>
                      <TableCell className="text-right">{it.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(it.price)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(it.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>

            <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatCurrency(inv.subtotal)} />
              {inv.discountAmount > 0 && <Row label="Discount" value={`- ${formatCurrency(inv.discountAmount)}`} />}
              {inv.taxAmount > 0 && <Row label={`Tax (${inv.taxPercent}%)`} value={formatCurrency(inv.taxAmount)} />}
              {inv.roundOff !== 0 && <Row label="Round off" value={formatCurrency(inv.roundOff)} />}
              <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{formatCurrency(inv.total)}</span></div>
              <Row label="Paid" value={formatCurrency(inv.amountPaid)} />
              {inv.balance > 0 && <Row label="Balance due" value={formatCurrency(inv.balance)} bold />}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{inv.customerSnapshot.name}</p>
              {inv.customerSnapshot.phone && <p className="text-muted-foreground">{inv.customerSnapshot.phone}</p>}
              {inv.customerSnapshot.address && <p className="text-muted-foreground">{inv.customerSnapshot.address}</p>}
              {inv.customerSnapshot.gstin && <p className="text-muted-foreground">GSTIN: {inv.customerSnapshot.gstin}</p>}
              <div className="mt-3">
                <Badge variant={inv.paymentStatus === 'paid' ? 'success' : inv.paymentStatus === 'partial' ? 'warning' : 'destructive'}>
                  {inv.paymentStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => void openInvoicePdf(inv._id, inv.invoiceNumber, 'view').catch((e) => toast.error(getApiError(e).message))}>
              <FileText className="h-4 w-4" /> View PDF
            </Button>
            <Button variant="outline" onClick={() => void openInvoicePdf(inv._id, inv.invoiceNumber, 'download').catch((e) => toast.error(getApiError(e).message))}>
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>

          {!cancelled && (
            <>
              <Button className="w-full" onClick={() => setShareOpen(true)}>
                <Share2 className="h-4 w-4" /> Share on WhatsApp
              </Button>
              {customer && inv.balance > 0 && (
                <Button variant="success" className="w-full" onClick={() => setPayOpen(true)}>
                  <Wallet className="h-4 w-4" /> Record payment
                </Button>
              )}
              <Button variant="destructive" className="w-full" onClick={() => setCancelOpen(true)}>
                <Ban className="h-4 w-4" /> Cancel invoice
              </Button>
            </>
          )}
        </div>
      </div>

      <ShareInvoiceDialog invoiceId={inv._id} invoiceNumber={inv.invoiceNumber} open={shareOpen} onOpenChange={setShareOpen} />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel ${inv.invoiceNumber}?`}
        description="Stock will be returned to inventory and the customer's dues reversed. This cannot be undone."
        confirmLabel="Cancel invoice"
        destructive
        loading={cancel.isPending}
        onConfirm={doCancel}
      />
      {customer && (
        <RecordPaymentDialog open={payOpen} onOpenChange={setPayOpen} customer={customer} invoiceId={inv._id} defaultAmount={inv.balance} />
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : 'text-muted-foreground'}`}>
      <span>{label}</span>
      <span className={bold ? 'text-foreground' : ''}>{value}</span>
    </div>
  );
}
