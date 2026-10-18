import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useRecordPayment } from '@/hooks/payments';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Customer, PaymentMethod } from '@/types';

export function RecordPaymentDialog({
  open,
  onOpenChange,
  customer,
  invoiceId,
  defaultAmount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: Customer;
  invoiceId?: string;
  defaultAmount?: number;
}) {
  const record = useRecordPayment();
  const [amount, setAmount] = useState(defaultAmount ?? customer.balance ?? 0);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    if (!amount || amount <= 0) return toast.error('Enter an amount greater than zero');
    try {
      await record.mutateAsync({ customerId: customer._id, amount, method, invoiceId, notes: notes.trim() || undefined });
      toast.success(`Payment of ${formatCurrency(amount)} recorded`);
      onOpenChange(false);
      setNotes('');
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {customer.name}
            {customer.balance > 0 && <> · Due {formatCurrency(customer.balance)}</>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="amt">Amount received</Label>
            <Input id="amt" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label htmlFor="pm">Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger id="pm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pn">Notes</Label>
            <Input id="pn" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          </div>
          <Button className="w-full" onClick={submit} disabled={record.isPending}>
            {record.isPending && <Spinner className="h-4 w-4" />} Save payment
          </Button>
          {invoiceId ? (
            <p className="text-xs text-muted-foreground">Applied to this invoice first, then older dues.</p>
          ) : (
            <p className="text-xs text-muted-foreground">Applied to the oldest unpaid invoices first.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
