import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Spinner, LoadingScreen } from '@/components/ui/spinner';
import { useSuppliers } from '@/hooks/suppliers';
import { useCreatePurchase, useUpdatePurchase, usePurchase } from '@/hooks/purchases';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Product, Variant } from '@/types';

// Flat line so both a freshly picked product and a saved purchase item prefill the same way.
interface Line {
  key: string;
  productId: string;
  variantId: string;
  designNumber: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  costPrice: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function PurchaseForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { data: suppliers } = useSuppliers({ limit: 100 });
  const { data: existing, isLoading: loadingExisting } = usePurchase(id);
  const create = useCreatePurchase();
  const update = useUpdatePurchase(id ?? '');

  const [supplierId, setSupplierId] = useState('');
  const [billNo, setBillNo] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState('');

  // Prefill when editing an existing purchase.
  useEffect(() => {
    if (!existing) return;
    setSupplierId(typeof existing.supplier === 'object' ? existing.supplier._id : existing.supplier);
    setBillNo(existing.supplierBillNo ?? '');
    setLines(
      existing.items.map((i, idx) => ({
        key: `${idx}-${i.variantId}`,
        productId: i.product,
        variantId: i.variantId,
        designNumber: i.designNumber,
        productName: i.productName,
        color: i.color,
        size: i.size,
        quantity: i.quantity,
        costPrice: i.costPrice,
      })),
    );
    setDiscount(existing.discount || 0);
    setTax(existing.tax || 0);
    setAmountPaid(existing.amountPaid || 0);
    setNotes(existing.notes ?? '');
  }, [existing]);

  const subtotal = useMemo(() => round2(lines.reduce((s, l) => s + l.costPrice * l.quantity, 0)), [lines]);
  const total = round2(subtotal - (discount || 0) + (tax || 0));
  const balance = round2(total - (amountPaid || 0));

  const addLine = (product: Product, variant: Variant) =>
    setLines((prev) =>
      prev.find((l) => l.variantId === variant._id)
        ? prev
        : [
            ...prev,
            {
              key: `${Date.now()}`,
              productId: product._id,
              variantId: variant._id,
              designNumber: product.designNumber,
              productName: product.name,
              color: variant.color,
              size: variant.size,
              quantity: 1,
              costPrice: variant.costPrice ?? product.costPrice ?? 0,
            },
          ],
    );
  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const submit = async () => {
    if (!supplierId) return toast.error('Select a supplier');
    if (lines.length === 0) return toast.error('Add at least one item');
    const body = {
      supplierId,
      supplierBillNo: billNo.trim() || undefined,
      items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, costPrice: l.costPrice })),
      discount: discount || undefined,
      tax: tax || undefined,
      amountPaid: amountPaid || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      if (isEdit) {
        await update.mutateAsync(body);
        toast.success('Purchase updated and stock adjusted');
      } else {
        await create.mutateAsync(body);
        toast.success('Purchase recorded and stock added');
      }
      navigate('/purchases');
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  const pending = create.isPending || update.isPending;

  if (isEdit && loadingExisting) return <LoadingScreen />;
  if (isEdit && existing && existing.status === 'cancelled') {
    return (
      <div>
        <PageHeader title="Edit purchase" actions={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /> Back</Button>} />
        <EmptyState icon={Truck} title="Cancelled purchase" description="A cancelled purchase can't be edited." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit purchase${existing ? ` ${existing.purchaseNumber}` : ''}` : 'New purchase'}
        subtitle={isEdit ? 'Adjust items — stock and supplier balance update automatically.' : 'Receive stock from a supplier.'}
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
                        <p className="truncate font-medium">{l.designNumber} · {l.color}/{l.size}</p>
                        <p className="text-xs text-muted-foreground">{l.productName}</p>
                      </div>
                      <button onClick={() => remove(l.key)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input inputMode="numeric" value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Cost ₹</Label>
                        <Input inputMode="decimal" value={l.costPrice} onChange={(e) => updateLine(l.key, { costPrice: Math.max(0, Number(e.target.value) || 0) })} />
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
              <Button className="w-full" size="lg" onClick={submit} disabled={pending}>
                {pending && <Spinner className="h-5 w-5" />} {isEdit ? 'Save changes' : 'Save purchase'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ProductPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={addLine} requireStock={false} />
    </div>
  );
}
