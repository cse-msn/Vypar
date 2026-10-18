import { lazy, Suspense, useState } from 'react';
import { Search, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';

// Lazy: the scanner pulls in the ~400 KB zxing library — only load it when opened.
const BarcodeScanner = lazy(() =>
  import('@/components/BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })),
);
import { useProducts, lookupProduct } from '@/hooks/products';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Product, Variant } from '@/types';

export function ProductPicker({
  open,
  onOpenChange,
  onPick,
  requireStock = true,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (product: Product, variant: Variant) => void;
  requireStock?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const { data, isFetching } = useProducts({ search: search || undefined, limit: 15 });

  const pick = (product: Product, variant: Variant) => {
    onPick(product, variant);
    onOpenChange(false);
  };

  const handleScan = async (code: string) => {
    try {
      const res = await lookupProduct({ barcode: code });
      if (res.variant) pick(res.product, res.variant as Variant);
      else {
        setSearch(res.product.designNumber);
        toast.message('Choose a colour / size', { description: res.product.name });
      }
    } catch (err) {
      // Not a known barcode — fall back to searching by the scanned text.
      setSearch(code);
      toast.error(getApiError(err).message);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add product</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search design no, name, brand…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => setScanOpen(true)} aria-label="Scan barcode">
              <ScanLine className="h-5 w-5" />
            </Button>
          </div>

          <div className="max-h-[55vh] space-y-3 overflow-y-auto">
            {isFetching && !data && (
              <div className="py-6 text-center"><Spinner className="mx-auto h-5 w-5 text-primary" /></div>
            )}
            {data?.data.map((product) => (
              <div key={product._id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold">{product.designNumber}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{product.name}</span>
                  </div>
                  <span className="shrink-0 text-sm font-medium">{formatCurrency(product.sellingPrice)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {product.variants.map((v) => {
                    const out = requireStock && v.quantity <= 0;
                    return (
                      <button
                        key={v._id}
                        disabled={out}
                        onClick={() => pick(product, v)}
                        className="rounded-md border px-2.5 py-1.5 text-xs transition-colors enabled:hover:border-primary enabled:hover:bg-primary/5 disabled:opacity-40"
                      >
                        <span className="font-medium">{v.color} / {v.size}</span>
                        <Badge variant={v.quantity > 0 ? 'secondary' : 'destructive'} className="ml-1.5">
                          {v.quantity}
                        </Badge>
                      </button>
                    );
                  })}
                  {product.variants.length === 0 && (
                    <span className="text-xs text-muted-foreground">No variants added</span>
                  )}
                </div>
              </div>
            ))}
            {data && data.data.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No products found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {scanOpen && (
        <Suspense fallback={null}>
          <BarcodeScanner open={scanOpen} onOpenChange={setScanOpen} onDetected={handleScan} />
        </Suspense>
      )}
    </>
  );
}
