import { useState } from 'react';
import { toast } from 'sonner';
import { Printer, FileText, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { openPdf } from '@/lib/pdf';
import { getApiError } from '@/lib/api';
import type { Product } from '@/types';

export function LabelDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [variantId, setVariantId] = useState(''); // '' = all variants
  const [copies, setCopies] = useState(1);
  const [format, setFormat] = useState<'sheet' | 'roll'>('roll');

  const variantOptions: ComboboxOption[] = [
    { value: '', label: `All variants (${product.variants.length})` },
    ...product.variants.map((v) => ({
      value: v._id,
      label: `${v.color} / ${v.size} · ${v.sku} · ${v.quantity} in stock`,
    })),
  ];

  const print = (mode: 'view' | 'download') => {
    const q = new URLSearchParams();
    if (variantId) q.set('variantId', variantId);
    q.set('copies', String(Math.max(1, copies)));
    q.set('format', format);
    openPdf(`/products/${product._id}/labels?${q.toString()}`, `labels-${product.designNumber}.pdf`, mode).catch((e) =>
      toast.error(getApiError(e).message),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" /> Print labels
          </DialogTitle>
          <DialogDescription>
            {product.designNumber} · {product.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Paper / printer</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as 'sheet' | 'roll')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="roll">Label printer — 50 × 25 mm (one per label)</SelectItem>
                <SelectItem value="sheet">A4 sticker sheet — 12 tags/page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Variant</Label>
            <Combobox
              value={variantId}
              onValueChange={setVariantId}
              options={variantOptions}
              placeholder="All variants"
              searchPlaceholder="Search colour, size, code…"
              emptyText="No matching variant"
            />
          </div>
          <div>
            <Label htmlFor="copies">Copies (per variant)</Label>
            <Input
              id="copies"
              type="number"
              min={1}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {format === 'roll'
                ? 'One 50 × 25 mm label per page — for thermal/label printers.'
                : 'Set this to the number of pieces to print one tag each. 12 tags per A4 sheet.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => print('view')}>
              <FileText className="h-4 w-4" /> View
            </Button>
            <Button variant="outline" onClick={() => print('download')}>
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Each tag shows the design no, barcode + item code, colour, size and coded price.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
