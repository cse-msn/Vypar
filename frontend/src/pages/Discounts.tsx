import { useState } from 'react';
import { Plus, Search, TicketPercent, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { usePagination } from '@/hooks/usePagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { useDiscounts, useCreateDiscount, useUpdateDiscount, useDeleteDiscount } from '@/hooks/discounts';
import { useAuth } from '@/context/AuthContext';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Discount, DiscountType } from '@/types';

const TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Percentage off',
  fixed: 'Fixed amount off',
  free_shipping: 'Free shipping',
};

const describeValue = (d: Discount) =>
  d.type === 'percentage' ? `${d.value}% off` : d.type === 'fixed' ? `${formatCurrency(d.value)} off` : 'Free shipping';

export default function Discounts() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [search, setSearch] = useState('');
  const { page, setPage, limit, setLimit, reset } = usePagination();
  const { data, isLoading } = useDiscounts({ search: search || undefined, page, limit });
  const [editing, setEditing] = useState<Discount | null | 'new'>(null);
  const [toDelete, setToDelete] = useState<Discount | null>(null);
  const del = useDeleteDiscount();

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete._id);
      toast.success('Discount deleted');
      setToDelete(null);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Discounts"
        subtitle="Coupon codes customers can apply at checkout."
        actions={isOwner ? <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add discount</Button> : undefined}
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by code…" value={search} onChange={(e) => { setSearch(e.target.value); reset(); }} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !data?.data.length ? (
        <EmptyState icon={TicketPercent} title="No discounts yet" description="Create a coupon code to offer at checkout." />
      ) : (
        <>
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Min. order</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Status</TableHead>
                  {isOwner && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((d) => (
                  <TableRow key={d._id}>
                    <TableCell className="font-medium">
                      {d.code}
                      {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
                    </TableCell>
                    <TableCell>{describeValue(d)}</TableCell>
                    <TableCell className="text-muted-foreground">{d.minSubtotal > 0 ? formatCurrency(d.minSubtotal) : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.usageCount}{d.usageLimit > 0 ? ` / ${d.usageLimit}` : ''}
                    </TableCell>
                    <TableCell>
                      {d.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(d)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setToDelete(d)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
          <Pagination meta={data.meta} onPageChange={setPage} onLimitChange={setLimit} />
        </>
      )}

      {editing && <DiscountFormDialog discount={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`Delete ${toDelete?.code}?`}
        description="Customers will no longer be able to apply this code."
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function DiscountFormDialog({ discount, onClose }: { discount: Discount | null; onClose: () => void }) {
  const create = useCreateDiscount();
  const update = useUpdateDiscount(discount?._id ?? '');
  const [form, setForm] = useState({
    code: discount?.code ?? '',
    description: discount?.description ?? '',
    type: discount?.type ?? ('percentage' as DiscountType),
    value: discount?.value?.toString() ?? '',
    minSubtotal: discount?.minSubtotal?.toString() ?? '',
    maxDiscount: discount?.maxDiscount?.toString() ?? '',
    usageLimit: discount?.usageLimit?.toString() ?? '',
    perCustomerLimit: discount?.perCustomerLimit?.toString() ?? '',
    active: discount?.active ?? true,
  });

  const num = (v: string) => (v.trim() === '' ? 0 : Number(v));

  const save = async () => {
    if (!form.code.trim()) return toast.error('Code is required');
    if (form.type !== 'free_shipping' && num(form.value) <= 0) return toast.error('Enter a discount value');
    const body = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || undefined,
      type: form.type,
      value: form.type === 'free_shipping' ? 0 : num(form.value),
      minSubtotal: num(form.minSubtotal),
      maxDiscount: num(form.maxDiscount),
      usageLimit: num(form.usageLimit),
      perCustomerLimit: num(form.perCustomerLimit),
      active: form.active,
    };
    try {
      if (discount) await update.mutateAsync(body);
      else await create.mutateAsync(body);
      toast.success(discount ? 'Discount updated' : 'Discount created');
      onClose();
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{discount ? 'Edit discount' : 'Add discount'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Code *</Label>
            <Input autoFocus value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="DIWALI10" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as DiscountType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as DiscountType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Diwali festive offer" />
          </div>
          {form.type !== 'free_shipping' && (
            <div>
              <Label>{form.type === 'percentage' ? 'Percentage off (%)' : 'Amount off (₹)'}</Label>
              <Input inputMode="numeric" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
          )}
          {form.type === 'percentage' && (
            <div>
              <Label>Max discount (₹, 0 = none)</Label>
              <Input inputMode="numeric" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
            </div>
          )}
          <div>
            <Label>Minimum order (₹)</Label>
            <Input inputMode="numeric" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
          </div>
          <div>
            <Label>Total uses (0 = unlimited)</Label>
            <Input inputMode="numeric" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
          </div>
          <div>
            <Label>Uses per customer (0 = unlimited)</Label>
            <Input inputMode="numeric" value={form.perCustomerLimit} onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" />
            Active
          </label>
        </div>
        <Button className="mt-2 w-full" onClick={save} disabled={pending}>
          {pending && <Spinner className="h-4 w-4" />} Save
        </Button>
      </DialogContent>
    </Dialog>
  );
}
