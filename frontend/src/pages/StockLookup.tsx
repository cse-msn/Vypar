import { lazy, Suspense, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ScanLine, Search, Minus, Plus, Package } from 'lucide-react';
import { toast } from 'sonner';
import { lookupProduct } from '@/hooks/products';
import { api, getApiError } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { PageHeader } from '@/components/PageHeader';

// Lazy: defer the ~400 KB zxing barcode library until the scanner is opened.
const BarcodeScanner = lazy(() =>
  import('@/components/BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })),
);
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { formatCurrency } from '@/lib/format';
import type { Product, Variant } from '@/types';

export default function StockLookup() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [design, setDesign] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ product: Product; matches: Variant[] } | null>(null);

  const runLookup = async (params: { barcode?: string; design?: string; color?: string; size?: string }) => {
    setLoading(true);
    setResult(null);
    try {
      const data = await lookupProduct(params);
      setResult({ product: data.product, matches: data.matches.length ? data.matches : data.product.variants });
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const onScan = (scanned: string) => {
    setCode(scanned);
    void runLookup({ barcode: scanned });
  };

  const adjust = async (variant: Variant, delta: number) => {
    if (!result) return;
    try {
      await api.post(`/products/${result.product._id}/variants/${variant._id}/adjust`, { delta });
      qc.invalidateQueries({ queryKey: qk.products });
      qc.invalidateQueries({ queryKey: qk.reports });
      // refresh the on-screen numbers
      const data = await lookupProduct({ barcode: variant.sku });
      setResult({ product: data.product, matches: data.product.variants });
      toast.success('Stock updated');
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div>
      <PageHeader title="Stock lookup" subtitle="Scan a barcode or search by design, colour & size." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By barcode / SKU</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Scan or type barcode"
                onKeyDown={(e) => e.key === 'Enter' && code.trim() && runLookup({ barcode: code.trim() })}
              />
              <Button variant="outline" onClick={() => setScanOpen(true)} aria-label="Scan">
                <ScanLine className="h-4 w-4" />
              </Button>
            </div>
            <Button className="w-full" disabled={!code.trim()} onClick={() => runLookup({ barcode: code.trim() })}>
              <Search className="h-4 w-4" /> Look up
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By design number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Design number</Label>
              <Input value={design} onChange={(e) => setDesign(e.target.value)} placeholder="e.g. D104" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Colour</Label>
                <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="optional" />
              </div>
              <div>
                <Label>Size</Label>
                <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="optional" />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!design.trim()}
              onClick={() => runLookup({ design: design.trim(), color: color.trim() || undefined, size: size.trim() || undefined })}
            >
              <Search className="h-4 w-4" /> Look up
            </Button>
          </CardContent>
        </Card>
      </div>

      {loading && (
        <div className="mt-6 flex justify-center">
          <Spinner className="h-6 w-6 text-primary" />
        </div>
      )}

      {result && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-muted">
                {result.product.images?.[0] || result.product.imageUrl ? (
                  <img src={result.product.images?.[0] || result.product.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">{result.product.designNumber}</CardTitle>
                <p className="text-sm text-muted-foreground">{result.product.name}</p>
              </div>
              <Badge className="ml-auto" variant="secondary">{result.product.totalStock} total</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {result.matches.map((v) => (
                <div key={v._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {v.color} / {v.size}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.sku} · {formatCurrency(v.sellingPrice ?? result.product.sellingPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => adjust(v, -1)} aria-label="Decrease">
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span
                      className={`w-14 text-center text-lg font-bold ${
                        v.quantity === 0 ? 'text-destructive' : v.quantity <= v.lowStockThreshold ? 'text-warning' : ''
                      }`}
                    >
                      {v.quantity}
                    </span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => adjust(v, 1)} aria-label="Increase">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {result.product.customFields && result.product.customFields.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Details</p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {result.product.customFields.map((f, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{f.label}</dt>
                      <dd className="font-medium">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {scanOpen && (
        <Suspense fallback={null}>
          <BarcodeScanner open={scanOpen} onOpenChange={setScanOpen} onDetected={onScan} />
        </Suspense>
      )}
    </div>
  );
}
