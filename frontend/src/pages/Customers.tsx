import { useState } from 'react';
import { Plus, Search, Users, Pencil, Wallet, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { RecordPaymentDialog } from '@/components/RecordPaymentDialog';
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
import { useCustomers, useCreateCustomer, useUpdateCustomer, useCustomerLedger } from '@/hooks/customers';
import { getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Customer } from '@/types';

export default function Customers() {
  const [search, setSearch] = useState('');
  const { page, setPage, limit, setLimit, reset } = usePagination();
  const { data, isLoading } = useCustomers({ search: search || undefined, page, limit });
  const [editing, setEditing] = useState<Customer | null | 'new'>(null);
  const [payFor, setPayFor] = useState<Customer | null>(null);
  const [ledgerFor, setLedgerFor] = useState<Customer | null>(null);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage customers, dues and payments."
        actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add customer</Button>}
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name or phone…" value={search} onChange={(e) => { setSearch(e.target.value); reset(); }} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !data?.data.length ? (
        <EmptyState icon={Users} title="No customers yet" description="Add a customer to track their purchases and dues." />
      ) : (
        <>
        <TableWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Balance due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((c) => (
                <TableRow key={c._id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone || '—'}</TableCell>
                  <TableCell className="text-right">
                    {c.balance > 0 ? (
                      <Badge variant="warning">{formatCurrency(c.balance)}</Badge>
                    ) : c.balance < 0 ? (
                      <Badge variant="success">Credit {formatCurrency(-c.balance)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Ledger" onClick={() => setLedgerFor(c)}>
                        <ScrollText className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Record payment" onClick={() => setPayFor(c)}>
                        <Wallet className="h-4 w-4 text-success" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        <Pagination meta={data.meta} onPageChange={setPage} onLimitChange={setLimit} />
        </>
      )}

      {editing && <CustomerFormDialog customer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {payFor && <RecordPaymentDialog open={!!payFor} onOpenChange={(v) => !v && setPayFor(null)} customer={payFor} />}
      {ledgerFor && <LedgerDialog customer={ledgerFor} onClose={() => setLedgerFor(null)} />}
    </div>
  );
}

function CustomerFormDialog({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?._id ?? '');
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    whatsapp: customer?.whatsapp ?? '',
    email: customer?.email ?? '',
    gstin: customer?.gstin ?? '',
    address: customer?.address ?? '',
  });

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    const body = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      email: form.email.trim() || undefined,
      gstin: form.gstin.trim() || undefined,
      address: form.address.trim() || undefined,
    };
    try {
      if (customer) await update.mutateAsync(body);
      else await create.mutateAsync(body);
      toast.success(customer ? 'Customer updated' : 'Customer added');
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
          <DialogTitle>{customer ? 'Edit customer' : 'Add customer'}</DialogTitle>
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
            <Label>WhatsApp</Label>
            <Input inputMode="tel" placeholder="Defaults to phone" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>GSTIN</Label>
            <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
        <Button className="mt-2 w-full" onClick={save} disabled={pending}>
          {pending && <Spinner className="h-4 w-4" />} Save
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function LedgerDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { data, isLoading } = useCustomerLedger(customer._id);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer.name} · ledger</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center"><Spinner className="mx-auto h-6 w-6 text-primary" /></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              Current balance:{' '}
              <span className="font-semibold">
                {data && data.customer.balance > 0 ? `${formatCurrency(data.customer.balance)} due` : data && data.customer.balance < 0 ? `${formatCurrency(-data.customer.balance)} credit` : 'Settled'}
              </span>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Invoices</p>
              {!data?.invoices.length ? (
                <p className="text-sm text-muted-foreground">No invoices</p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.invoices.map((i) => (
                    <li key={i._id} className="flex justify-between py-1.5">
                      <span>{i.invoiceNumber} <span className="text-muted-foreground">· {formatDate(i.date)}</span></span>
                      <span>{formatCurrency(i.total)} {i.balance > 0 && <Badge variant="warning" className="ml-1">due {formatCurrency(i.balance)}</Badge>}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Payments</p>
              {!data?.payments.length ? (
                <p className="text-sm text-muted-foreground">No payments</p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.payments.map((p) => (
                    <li key={p._id} className="flex justify-between py-1.5">
                      <span>{p.paymentNumber} <span className="text-muted-foreground">· {formatDate(p.date)} · {p.method}</span></span>
                      <span className="text-success">{formatCurrency(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
