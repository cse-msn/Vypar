import { useState } from 'react';
import { UserPlus, Search, User, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomers, useCreateCustomer } from '@/hooks/customers';
import { getApiError } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { Customer } from '@/types';

export function CustomerPicker({
  value,
  onChange,
  allowWalkIn = true,
}: {
  value: Customer | null;
  onChange: (c: Customer | null) => void;
  allowWalkIn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const { data, isLoading } = useCustomers({ search, limit: 20 });
  const createCustomer = useCreateCustomer();

  const pick = (c: Customer | null) => {
    onChange(c);
    setOpen(false);
  };

  const add = async () => {
    if (!name.trim()) return toast.error('Enter a customer name');
    try {
      const c = await createCustomer.mutateAsync({
        name: name.trim(),
        phone: phone.trim() || undefined,
        altPhone: altPhone.trim() || undefined,
        gstin: gstin.trim() || undefined,
        address: address.trim() || undefined,
      });
      toast.success('Customer added');
      setName('');
      setPhone('');
      setAltPhone('');
      setGstin('');
      setAddress('');
      setAdding(false);
      pick(c);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm"
      >
        <span className="flex items-center gap-2 truncate">
          <User className="h-4 w-4 text-muted-foreground" />
          {value ? (
            <span className="truncate">
              {value.name}
              {value.phone ? <span className="text-muted-foreground"> · {value.phone}</span> : null}
            </span>
          ) : (
            <span className="text-muted-foreground">{allowWalkIn ? 'Walk-in customer (tap to select)' : 'Select customer'}</span>
          )}
        </span>
        {value && allowWalkIn && (
          <X
            className="h-4 w-4 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select customer</DialogTitle>
          </DialogHeader>

          {!adding ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone…" className="pl-9" autoFocus />
              </div>

              {allowWalkIn && (
                <Button variant="outline" onClick={() => pick(null)} className="justify-start">
                  <User className="h-4 w-4" /> Walk-in customer (no account)
                </Button>
              )}

              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Spinner className="h-5 w-5 text-primary" />
                  </div>
                ) : !data?.data.length ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No customers found</p>
                ) : (
                  data.data.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => pick(c)}
                      className="flex w-full items-center justify-between border-b px-3 py-2.5 text-left text-sm last:border-0 hover:bg-accent"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{c.phone || 'No phone'}</span>
                      </span>
                      {value?._id === c._id && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))
                )}
              </div>

              <Button variant="secondary" onClick={() => setAdding(true)}>
                <UserPlus className="h-4 w-4" /> Add new customer
              </Button>
            </>
          ) : (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              <div>
                <Label>Full name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" autoFocus />
              </div>
              <div>
                <Label>Contact number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" inputMode="tel" />
              </div>
              <div>
                <Label>Alternate number (optional)</Label>
                <Input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} placeholder="optional second number" inputMode="tel" />
              </div>
              <div>
                <Label>GST number</Label>
                <Input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="e.g. 27ABCDE1234F1Z5" />
              </div>
              <div>
                <Label>Address</Label>
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Customer address" rows={2} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setAdding(false)}>
                  Back
                </Button>
                <Button className="flex-1" onClick={add} disabled={createCustomer.isPending}>
                  {createCustomer.isPending && <Spinner className="h-4 w-4" />} Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
