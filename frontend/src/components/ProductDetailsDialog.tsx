import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import type { Product } from '@/types';

function Meta({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

/** Read-only full details for a product: meta, prices, and every variant's scanner code + stock. */
export function ProductDetailsDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-2">
            {product.designNumber}
            <span className="text-base font-normal text-muted-foreground">· {product.name}</span>
          </DialogTitle>
          <DialogDescription>
            {product.totalStock} pcs in stock · {product.variants.length} variants
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {(product.images?.[0] || product.imageUrl) && (
            <img
              src={product.images?.[0] || product.imageUrl}
              alt=""
              className="h-28 w-28 rounded-lg border object-cover"
            />
          )}

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Meta label="Product code" value={product.code} />
            <Meta label="Category" value={product.category} />
            <Meta label="Sub-category" value={product.subCategory} />
            <Meta label="Size group" value={product.sizeGroup} />
            <Meta label="Brand" value={product.brand} />
            <Meta label="Fabric" value={product.fabric} />
            <Meta label="HSN code" value={product.hsnCode} />
            <Meta label="Unit" value={product.unit} />
            <Meta label="GST" value={product.taxRate != null ? `${product.taxRate}%` : undefined} />
            <Meta label="Cost" value={formatCurrency(product.costPrice)} />
            <Meta label="Selling price" value={formatCurrency(product.sellingPrice)} />
            <Meta label="B2C price" value={product.b2cPrice ? formatCurrency(product.b2cPrice) : undefined} />
            <Meta label="B2B price" value={product.b2bPrice ? formatCurrency(product.b2bPrice) : undefined} />
            <Meta label="Dupatta" value={product.dupatta} />
            <Meta label="Dupatta height" value={product.dupattaHeight || undefined} />
            <Meta label="Back opening" value={product.backOpening} />
            <Meta label="Blouse size" value={product.blouseSize} />
            <Meta label="Gher" value={product.gher || undefined} />
            <Meta label="Cap" value={product.cap} />
            <Meta label="Belt" value={product.belt} />
            <Meta label="Sleeves" value={product.sleeves} />
            <Meta label="Back closure" value={product.backClosure} />
            <Meta label="Bottom type" value={product.bottomType} />
          </dl>

          {product.description && (
            <div>
              <dt className="text-xs text-muted-foreground">Description</dt>
              <dd className="whitespace-pre-wrap text-sm">{product.description}</dd>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-semibold">Variants</p>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colour</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Scanner code</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.variants.map((v) => (
                    <TableRow key={v._id}>
                      <TableCell>{v.color}</TableCell>
                      <TableCell>{v.size}</TableCell>
                      <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                      <TableCell className="text-right">
                        {v.quantity <= v.lowStockThreshold ? (
                          <Badge variant="warning">{v.quantity}</Badge>
                        ) : (
                          v.quantity
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(v.sellingPrice ?? product.sellingPrice)}</TableCell>
                    </TableRow>
                  ))}
                  {product.variants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No variants
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
