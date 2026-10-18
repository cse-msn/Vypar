import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ProductPicker } from '@/components/ProductPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useSuppliers } from '@/hooks/suppliers';
import { useCreatePurchase } from '@/hooks/purchases';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Product, Variant } from '@/types';

interface Line {
  key: string;
  product: Product;
  variant: Variant;
  quantity: number;
  costPrice: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function PurchaseForm() {
  const navigate = useNavigate();
  const { data: suppliers } = useSuppliers({ limit: 100 });
  const create = useCreatePurchase();

  const [supplierId, setSupplierId] = useState('');
  const [billNo, setBillNo] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState('');

  const subtotal = useMemo(() => round2(lines.reduce((s, l) => s + l.costPrice * l.quantity, 0)), [lines]);
  const total = round2(subtotal - (discount || 0) + (tax || 0));
  const balance = round2(total - (amountPaid || 0));

  const addLine = (product: Product, variant: Variant) =>
    setLines((prev) =>
      prev.find((l) => l.variant._id === variant._id)
        ? prev
        : [...prev, { key: `${Date.now()}`, product, variant, quantity: 1, costPrice: variant.costPrice ?? product.costPrice ?? 0 }],
    );
  const update = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const submit = async () => {
    if (!supplierId) return toast.error('Select a supplier');
    if (lines.length === 0) return toast.error('Add at least one item');
    try {
      await create.mutateAsync({
        supplierId,
        supplierBillNo: billNo.trim() || undefined,
        items: lines.map((l) => ({ productId: l.product._id, variantId: l.variant._id, quantity: l.quantity, costPrice: l.costPrice })),
        discount: discount || undefined,
        tax: tax || undefined,
        amountPaid: amountPaid || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Purchase recorded and stock added');
      navigate('/purchases');
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="New purchase"
        subtitle="Receive stock from a supplier."
        actions={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /> Back</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Supplier *</Label>
              <Combobox
                value={supplierId}
                onValueChange={setSupplierId}
                options={(suppliers?.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
                placeholder="Select supplier…"
                searchPlaceholder="Search suppliers…"
                emptyText="No suppliers found"
              />
            </div>
            <div>
              <Label>Supplier bill no.</Label>
              <Input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="optional" />
            </div>
          </div>

          <Button variant="outline" className="w-full" size="lg" onClick={() => setPickerOpen(true)}>
            <Plus className="h-5 w-5" /> Add product
          </Button>

          {lines.length === 0 ? (
            <EmptyState icon={Truck} title="No items" description="Add the products you're receiving." />
          ) : (
            <div className="space-y-2">
              {lines.map((l) => (
                <Card key={l.key}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{l.product.designNumber} · {l.variant.color}/{l.variant.size}</p>
                        <p className="text-xs text-muted-foreground">{l.product.name}</p>
                      </div>
                      <button onClick={() => remove(l.key)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input inputMode="numeric" value={l.quantity} onChange={(e) => update(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Cost ₹</Label>
                        <Input inputMode="decimal" value={l.costPrice} onChange={(e) => update(l.key, { costPrice: Math.max(0, Number(e.target.value) || 0) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Amount</Label>
                        <div className="flex h-10 items-center font-medium">{formatCurrency(l.costPrice * l.quantity)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Discount ₹</Label>
                  <Input inputMode="decimal" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Tax ₹</Label>
                  <Input inputMode="decimal" value={tax || ''} onChange={(e) => setTax(Number(e.target.value) || 0)} />
                </div>
              </div>
              <div className="space-y-1.5 border-t pt-3 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>
              <div>
                <Label>Amount paid</Label>
                <Input inputMode="decimal" value={amountPaid || ''} onChange={(e) => setAmountPaid(Number(e.target.value) || 0)} />
              </div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Balance payable</span><span className="font-semibold">{formatCurrency(balance)}</span></div>
              <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button className="w-full" size="lg" onClick={submit} disabled={create.isPending}>
                {create.isPending && <Spinner className="h-5 w-5" />} Save purchase
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ProductPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={addLine} requireStock={false} />
    </div>
  );
}
