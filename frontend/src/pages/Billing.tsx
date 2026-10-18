import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Minus, ShoppingCart, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { CustomerPicker } from '@/components/CustomerPicker';
import { ProductPicker } from '@/components/ProductPicker';
import { ShareInvoiceDialog } from '@/components/ShareInvoiceDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import { Spinner } from '@/components/ui/spinner';
import { useCreateInvoice } from '@/hooks/invoices';
import { useOnline } from '@/hooks/useOnline';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Customer, PaymentMethod, Product, Variant } from '@/types';

interface Line {
  key: string;
  product: Product;
  variant: Variant;
  quantity: number;
  price: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const newKey = () => `${Date.now()}-${Math.round(performance.now())}`;

export default function Billing() {
  const online = useOnline();
  const create = useCreateInvoice();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [roundOff, setRoundOff] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState('');
  const paidTouched = useRef(false);
  const idemKey = useRef(crypto.randomUUID());
  const [shareFor, setShareFor] = useState<{ id: string; number: string } | null>(null);

  const subtotal = useMemo(() => round2(lines.reduce((s, l) => s + l.price * l.quantity, 0)), [lines]);
  const discount = Math.min(discountAmount || 0, subtotal);
  const taxable = round2(subtotal - discount);
  const taxAmount = round2((taxable * (taxPercent || 0)) / 100);
  let total = round2(taxable + taxAmount);
  if (roundOff) total = Math.round(total);
  const balance = round2(total - (amountPaid || 0));

  // Default "amount paid" to the full total until the user edits it.
  useEffect(() => {
    if (!paidTouched.current) setAmountPaid(total);
  }, [total]);

  const addLine = (product: Product, variant: Variant) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.variant._id === variant._id);
      if (existing) {
        return prev.map((l) =>
          l.variant._id === variant._id ? { ...l, quantity: Math.min(l.quantity + 1, variant.quantity) } : l,
        );
      }
      return [
        ...prev,
        { key: newKey(), product, variant, quantity: 1, price: variant.sellingPrice ?? product.sellingPrice ?? 0 },
      ];
    });
    // Default the bill's GST% from the product's tax rate (only if not set yet).
    if (product.taxRate && product.taxRate > 0) setTaxPercent((t) => (t === 0 ? product.taxRate! : t));
  };

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const reset = () => {
    setCustomer(null);
    setLines([]);
    setDiscountAmount(0);
    setTaxPercent(0);
    setRoundOff(false);
    setAmountPaid(0);
    setNotes('');
    setPaymentMethod('cash');
    paidTouched.current = false;
    idemKey.current = crypto.randomUUID();
  };

  const overStock = lines.find((l) => l.quantity > l.variant.quantity);

  const submit = async () => {
    if (!online) return toast.error('You are offline. Billing needs a connection to keep stock accurate.');
    if (lines.length === 0) return toast.error('Add at least one item');
    if (overStock)
      return toast.error(
        `Only ${overStock.variant.quantity} in stock for ${overStock.product.designNumber} ${overStock.variant.color}/${overStock.variant.size}`,
      );

    try {
      const res = await create.mutateAsync({
        idempotencyKey: idemKey.current,
        customerId: customer?._id,
        customerName: customer ? undefined : 'Walk-in Customer',
        items: lines.map((l) => ({ productId: l.product._id, variantId: l.variant._id, quantity: l.quantity, price: l.price })),
        discountAmount: discount || undefined,
        taxPercent: taxPercent || undefined,
        roundOff,
        amountPaid: amountPaid || 0,
        paymentMethod,
        notes: notes.trim() || undefined,
      });
      toast.success(`Invoice ${res.data.invoiceNumber} saved`);
      setShareFor({ id: res.data._id, number: res.data.invoiceNumber });
      reset();
    } catch (err) {
      const e = getApiError(err);
      const detail =
        e.code === 'CONFLICT' && e.details && typeof e.details === 'object' && 'available' in e.details
          ? ` (available: ${(e.details as any).available})`
          : '';
      toast.error(e.message + detail);
    }
  };

  return (
    <div className="pb-28">
      <PageHeader title="New Bill" subtitle="Add items, pick a customer, and charge." />

      {!online && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
          <WifiOff className="h-4 w-4" /> Offline — billing is paused to keep inventory accurate.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Items */}
        <div className="space-y-4">
          <div>
            <Label>Customer</Label>
            <CustomerPicker value={customer} onChange={setCustomer} allowWalkIn />
          </div>

          <Button variant="outline" className="w-full" size="lg" onClick={() => setPickerOpen(true)}>
            <Plus className="h-5 w-5" /> Add product
          </Button>

          {lines.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No items yet" description="Tap “Add product” or scan a barcode to start billing." />
          ) : (
            <div className="space-y-2">
              {lines.map((l) => (
                <Card key={l.key}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {l.product.designNumber} <span className="text-muted-foreground">· {l.product.name}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {l.variant.color} / {l.variant.size} · {l.variant.quantity} in stock
                        </p>
                      </div>
                      <button onClick={() => removeLine(l.key)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-md border">
                        <button
                          className="grid h-9 w-9 place-items-center text-muted-foreground"
                          onClick={() => updateLine(l.key, { quantity: Math.max(1, l.quantity - 1) })}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          className="h-9 w-12 border-x text-center text-sm outline-none"
                          inputMode="numeric"
                          value={l.quantity}
                          onChange={(e) => updateLine(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        />
                        <button
                          className="grid h-9 w-9 place-items-center text-muted-foreground"
                          onClick={() => updateLine(l.key, { quantity: l.quantity + 1 })}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground">₹</span>
                        <input
                          className="h-9 w-20 rounded-md border px-2 text-right text-sm outline-none"
                          inputMode="decimal"
                          value={l.price}
                          onChange={(e) => updateLine(l.key, { price: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </div>

                      <div className="w-24 text-right font-semibold">{formatCurrency(l.price * l.quantity)}</div>
                    </div>
                    {l.quantity > l.variant.quantity && (
                      <p className="mt-1 text-xs text-destructive">Exceeds stock ({l.variant.quantity})</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="disc">Discount ₹</Label>
                  <Input id="disc" inputMode="decimal" value={discountAmount || ''} onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)} />
                </div>
                <div>
                  <Label htmlFor="tax">Tax %</Label>
                  <Input id="tax" inputMode="decimal" value={taxPercent || ''} onChange={(e) => setTaxPercent(Number(e.target.value) || 0)} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={roundOff} onChange={(e) => setRoundOff(e.target.checked)} />
                Round off to nearest ₹
              </label>

              <div className="space-y-1.5 border-t pt-3 text-sm">
                <Row label="Subtotal" value={formatCurrency(subtotal)} />
                {discount > 0 && <Row label="Discount" value={`- ${formatCurrency(discount)}`} />}
                {taxAmount > 0 && <Row label={`Tax (${taxPercent}%)`} value={formatCurrency(taxAmount)} />}
                <div className="flex items-end justify-between border-t pt-3">
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                  <span className="font-display text-2xl font-semibold leading-none text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <Label htmlFor="paid">Amount paid</Label>
                  <Input
                    id="paid"
                    inputMode="decimal"
                    value={amountPaid}
                    onChange={(e) => {
                      paidTouched.current = true;
                      setAmountPaid(Math.max(0, Number(e.target.value) || 0));
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="method">Method</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                    <SelectTrigger id="method"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Row label="Balance due" value={formatCurrency(balance)} bold={balance > 0} />

              <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-[3.75rem] z-20 border-t bg-card/95 px-4 py-3 backdrop-blur md:bottom-0 md:pl-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {lines.length} {lines.length === 1 ? 'item' : 'items'}
              {balance > 0 && lines.length > 0 ? ` · ${formatCurrency(balance)} due` : ''}
            </p>
            <p className="font-display text-2xl font-semibold leading-tight text-primary">{formatCurrency(total)}</p>
          </div>
          <Button size="lg" className="min-w-[160px]" onClick={submit} disabled={create.isPending || !online || lines.length === 0}>
            {create.isPending ? <Spinner className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
            Save &amp; Share
          </Button>
        </div>
      </div>

      <ProductPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={addLine} />
      {shareFor && (
        <ShareInvoiceDialog
          invoiceId={shareFor.id}
          invoiceNumber={shareFor.number}
          open={!!shareFor}
          onOpenChange={(v) => !v && setShareFor(null)}
        />
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold' : 'text-muted-foreground'}`}>
      <span>{label}</span>
      <span className={bold ? 'text-foreground' : ''}>{value}</span>
    </div>
  );
}
