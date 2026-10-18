import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Package, Pencil, Trash2, Boxes, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LabelDialog } from '@/components/LabelDialog';
import { Pagination } from '@/components/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts, useDeleteProduct } from '@/hooks/products';
import { useAuth } from '@/context/AuthContext';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Product } from '@/types';

export default function Products() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const { page, setPage, limit, setLimit, reset } = usePagination();
  const { data, isLoading } = useProducts({ search: search || undefined, page, limit });
  const del = useDeleteProduct();
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [labelFor, setLabelFor] = useState<Product | null>(null);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete._id);
      toast.success('Product deactivated');
      setToDelete(null);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage designs, colours, sizes & stock."
        actions={
          <Button asChild>
            <Link to="/products/new"><Plus className="h-4 w-4" /> Add product</Link>
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by design no, name or brand…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); reset(); }}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : !data || data.meta.total === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add your first design to start tracking stock."
          action={<Button asChild><Link to="/products/new"><Plus className="h-4 w-4" /> Add product</Link></Button>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((p) => {
              const low = p.variants.some((v) => v.quantity <= v.lowStockThreshold);
              return (
                <Card key={p._id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        {(p.images?.[0] || p.imageUrl) && (
                          <img src={p.images?.[0] || p.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-md border object-cover" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold">{p.designNumber}</p>
                          <p className="truncate text-sm text-muted-foreground">{p.name}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon" aria-label="Print labels" onClick={() => setLabelFor(p)}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button asChild variant="ghost" size="icon" aria-label="Edit">
                          <Link to={`/products/${p._id}/edit`}><Pencil className="h-4 w-4" /></Link>
                        </Button>
                        {user?.role === 'owner' && (
                          <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setToDelete(p)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Boxes className="h-4 w-4" /> {p.totalStock} pcs · {p.variants.length} variants
                      </span>
                      <span className="font-semibold">{formatCurrency(p.sellingPrice)}</span>
                    </div>
                    {low && <Badge variant="warning" className="mt-2">Low stock</Badge>}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Pagination meta={data.meta} onPageChange={setPage} onLimitChange={setLimit} />
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`Deactivate ${toDelete?.designNumber}?`}
        description="The product will be hidden from lists but its sales history is preserved."
        confirmLabel="Deactivate"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />

      {labelFor && (
        <LabelDialog product={labelFor} open={!!labelFor} onOpenChange={(v) => !v && setLabelFor(null)} />
      )}
    </div>
  );
}
