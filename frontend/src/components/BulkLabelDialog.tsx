import { useState } from 'react';
import { toast } from 'sonner';
import { Printer, FileText, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { openPdf } from '@/lib/pdf';
import { getApiError } from '@/lib/api';

/**
 * Print barcode tags for many products at once. When `search` is set it prints only
 * the matching products (same filter as the Products list); otherwise the whole catalogue.
 */
export function BulkLabelDialog({
  search,
  open,
  onOpenChange,
}: {
  search?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [copies, setCopies] = useState(1);
  const [format, setFormat] = useState<'sheet' | 'roll'>('roll');

  const print = (mode: 'view' | 'download') => {
    const q = new URLSearchParams();
    if (search?.trim()) q.set('search', search.trim());
    q.set('copies', String(Math.max(1, copies)));
    q.set('format', format);
    openPdf(`/products/labels?${q.toString()}`, 'labels-all.pdf', mode).catch((e) =>
      toast.error(getApiError(e).message),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" /> Print all labels
          </DialogTitle>
          <DialogDescription>
            {search?.trim()
              ? `Tags for every variant of products matching “${search.trim()}”.`
              : 'Tags for every variant of all active products.'}
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
            <Label htmlFor="bulk-copies">Copies (per variant)</Label>
            <Input
              id="bulk-copies"
              type="number"
              min={1}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              One tag per piece — set this to the pieces you have of each colour/size.
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
            Large catalogues make a big PDF — narrow with the search box first if needed.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
