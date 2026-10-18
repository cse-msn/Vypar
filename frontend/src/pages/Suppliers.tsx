import { useState } from 'react';
import { Plus, Search, Truck, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { useSuppliers, useCreateSupplier, useUpdateSupplier } from '@/hooks/suppliers';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Supplier } from '@/types';

export default function Suppliers() {
  const [search, setSearch] = useState('');
  const { page, setPage, limit, setLimit, reset } = usePagination();
  const { data, isLoading } = useSuppliers({ search: search || undefined, page, limit });
  const [editing, setEditing] = useState<Supplier | null | 'new'>(null);

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Vendors you purchase stock from."
        actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add supplier</Button>}
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name or phone…" value={search} onChange={(e) => { setSearch(e.target.value); reset(); }} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !data?.data.length ? (
        <EmptyState icon={Truck} title="No suppliers yet" description="Add a supplier to record purchases." />
      ) : (
        <>
        <TableWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead className="text-right">Payable</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((s) => (
                <TableRow key={s._id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.phone || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{s.gstin || '—'}</TableCell>
                  <TableCell className="text-right">
                    {s.balance > 0 ? <Badge variant="warning">{formatCurrency(s.balance)}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        <Pagination meta={data.meta} onPageChange={setPage} onLimitChange={setLimit} />
        </>
      )}

      {editing && <SupplierFormDialog supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SupplierFormDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier(supplier?._id ?? '');
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    gstin: supplier?.gstin ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
  });

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    const body = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      gstin: form.gstin.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    try {
      if (supplier) await update.mutateAsync(body);
      else await create.mutateAsync(body);
      toast.success(supplier ? 'Supplier updated' : 'Supplier added');
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
          <DialogTitle>{supplier ? 'Edit supplier' : 'Add supplier'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Name *</Label>
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>GSTIN</Label>
            <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <Button className="mt-2 w-full" onClick={save} disabled={pending}>
          {pending && <Spinner className="h-4 w-4" />} Save
        </Button>
      </DialogContent>
    </Dialog>
  );
}
