import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Minus, ShoppingCart, WifiOff, ScanLine, Camera } from 'lucide-react';
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
import { useSearchParams } from 'react-router-dom';
import { useCreateInvoice } from '@/hooks/invoices';
import { lookupProduct } from '@/hooks/products';
import { fetchDraft, saveDraft, deleteDraft } from '@/hooks/drafts';
import { useOnline } from '@/hooks/useOnline';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Customer, PaymentMethod, Product, Variant } from '@/types';

// Lazy: the camera scanner pulls in the ~400 KB zxing library — only load it when opened.
const BarcodeScanner = lazy(() =>
  import('@/components/BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })),
);

interface Line {
  key: string;
  product: Product;
  variant: Variant;
  quantity: number;
  price: number;
}

/** Snapshot of the Billing screen stored in a draft. */
interface DraftData {
  customer: Customer | null;
  lines: Line[];
  discountPercent: number;
  taxPercent: number;
  roundOff: boolean;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  notes: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const newKey = () => `${Date.now()}-${Math.round(performance.now())}`;

export default function Billing() {
  const online = useOnline();
  const create = useCreateInvoice();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [roundOff, setRoundOff] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState('');
  const paidTouched = useRef(false);
  const idemKey = useRef(crypto.randomUUID());
  const [shareFor, setShareFor] = useState<{ id: string; number: string } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCode, setScanCode] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const draftIdRef = useRef<string | null>(null);
  const draftLoadedRef = useRef(false);
  const latestRef = useRef<{ data: DraftData; total: number } | null>(null);

  const subtotal = useMemo(() => round2(lines.reduce((s, l) => s + l.price * l.quantity, 0)), [lines]);
  const discount = round2((subtotal * Math.min(discountPercent || 0, 100)) / 100);
  const taxable = round2(subtotal - discount);
  const taxAmount = round2((taxable * (taxPercent || 0)) / 100);
  let total = round2(taxable + taxAmount);
  if (roundOff) total = Math.round(total);
  const balance = round2(total - (amountPaid || 0));

  // Keep the newest state handy for the auto-save interval (which closes over refs, not state).
  latestRef.current = {
    data: { customer, lines, discountPercent, taxPercent, roundOff, amountPaid, paymentMethod, notes },
    total,
  };

  // Default "amount paid" to the full total until the user edits it.
  useEffect(() => {
    if (!paidTouched.current) setAmountPaid(total);
  }, [total]);

  // Open an existing draft when arriving via /billing?draft=<id> (once).
  useEffect(() => {
    const id = searchParams.get('draft');
    if (!id || draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    (async () => {
      try {
        const draft = await fetchDraft(id);
        const d = draft.data as Partial<DraftData> | null;
        if (d) {
          setCustomer(d.customer ?? null);
          setLines(Array.isArray(d.lines) ? d.lines : []);
          setDiscountPercent(d.discountPercent ?? 0);
          setTaxPercent(d.taxPercent ?? 0);
          setRoundOff(Boolean(d.roundOff));
          setAmountPaid(d.amountPaid ?? 0);
          setPaymentMethod(d.paymentMethod ?? 'cash');
          setNotes(d.notes ?? '');
          paidTouched.current = true; // keep the draft's amount instead of re-defaulting
        }
        draftIdRef.current = id;
        toast.message('Draft opened', { description: 'Continue, then Save & Share to finalise.' });
      } catch {
        toast.error('Could not open that draft');
      } finally {
        setSearchParams({}, { replace: true }); // clean the URL so a refresh doesn't reload it
      }
    })();
  }, [searchParams, setSearchParams]);

  // Auto-save the in-progress bill to a draft every 2 minutes (and when leaving the page),
  // until it is finalised via Save & Share (which deletes the draft).
  useEffect(() => {
    const save = async () => {
      const s = latestRef.current;
      if (!s || s.data.lines.length === 0) return;
      try {
        const draft = await saveDraft({
          id: draftIdRef.current,
          data: s.data,
          customerName: s.data.customer?.name || 'Walk-in Customer',
          itemCount: s.data.lines.length,
          total: s.total,
        });
        draftIdRef.current = draft._id;
      } catch {
        /* ignore auto-save failures — we'll try again on the next tick */
      }
    };
    const timer = setInterval(save, 2 * 60 * 1000);
    return () => {
      clearInterval(timer);
      void save(); // capture the latest state when navigating away (SPA keeps running)
    };
  }, []);

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

  // Resolve a scanned/typed tag code (the Code-128 item code) and drop it straight into the bill.
  const handleScanCode = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    try {
      const res = await lookupProduct({ barcode: code });
      const variant = res.variant;
      if (variant) {
        if (variant.quantity <= 0) {
          toast.error(`${res.product.designNumber} · ${variant.color}/${variant.size} is out of stock`);
        } else {
          addLine(res.product, variant);
          toast.success(`Added ${res.product.designNumber} · ${variant.color}/${variant.size}`);
        }
      } else {
        // Scanned a design with no exact colour/size — open the picker to choose one.
        toast.message('Pick a colour / size', { description: `${res.product.designNumber} · ${res.product.name}` });
        setPickerOpen(true);
      }
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setScanCode('');
      scanRef.current?.focus(); // ready for the next scan
    }
  };

  const submitScan = (e: React.FormEvent) => {
    e.preventDefault();
    void handleScanCode(scanCode);
  };

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const reset = () => {
    setCustomer(null);
    setLines([]);
    setDiscountPercent(0);
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
        discountPercent: discountPercent || undefined,
        taxPercent: taxPercent || undefined,
        roundOff,
        amountPaid: amountPaid || 0,
        paymentMethod,
        notes: notes.trim() || undefined,
      });
      toast.success(`Invoice ${res.data.invoiceNumber} saved`);
      setShareFor({ id: res.data._id, number: res.data.invoiceNumber });
      // The bill is finalised — drop its draft so it won't linger.
      if (draftIdRef.current) {
        void deleteDraft(draftIdRef.current).catch(() => undefined);
        draftIdRef.current = null;
      }
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

          <div>
            <Label htmlFor="scan">Scan tag</Label>
            <div className="flex gap-2">
              <form onSubmit={submitScan} className="relative flex-1">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                <Input
                  id="scan"
                  ref={scanRef}
                  autoFocus
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="done"
                  placeholder="Scan tag or type item code, then Enter"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  className="h-11 pl-10"
                />
              </form>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => setScanOpen(true)}
                aria-label="Scan with camera"
              >
                <Camera className="h-5 w-5" />
              </Button>
            </div>
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
                  <Label htmlFor="disc">Discount %</Label>
                  <Input id="disc" inputMode="decimal" value={discountPercent || ''} onChange={(e) => setDiscountPercent(Math.min(100, Number(e.target.value) || 0))} />
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
                {discount > 0 && <Row label={`Discount (${discountPercent}%)`} value={`- ${formatCurrency(discount)}`} />}
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
      {scanOpen && (
        <Suspense fallback={null}>
          <BarcodeScanner
            open={scanOpen}
            onOpenChange={setScanOpen}
            onDetected={(code) => {
              setScanOpen(false);
              void handleScanCode(code);
            }}
          />
        </Suspense>
      )}
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
