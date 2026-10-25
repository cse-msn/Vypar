import { useState } from 'react';
import { Plus, Truck, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useShippingZones, useCreateShippingZone, useUpdateShippingZone, useDeleteShippingZone } from '@/hooks/shipping';
import { useAuth } from '@/context/AuthContext';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { ShippingRate, ShippingZone, ZoneMatchType } from '@/types';

const MATCH_LABELS: Record<ZoneMatchType, string> = {
  all: 'All of India',
  states: 'Specific states',
  pincodes: 'Pincode prefixes',
};

const describeMatch = (z: ShippingZone) =>
  z.matchType === 'all'
    ? 'All of India'
    : z.matchType === 'states'
    ? z.states.join(', ') || 'No states set'
    : z.pincodePrefixes.map((p) => `${p}xxxx`).join(', ') || 'No pincodes set';

const describeRate = (r: ShippingRate) =>
  `${r.label}: ${r.price === 0 ? 'Free' : formatCurrency(r.price)}${r.freeAbove > 0 ? ` (free over ${formatCurrency(r.freeAbove)})` : ''}`;

export default function Shipping() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const { data: zones, isLoading } = useShippingZones();
  const [editing, setEditing] = useState<ShippingZone | null | 'new'>(null);
  const [toDelete, setToDelete] = useState<ShippingZone | null>(null);
  const del = useDeleteShippingZone();

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete._id);
      toast.success('Zone deleted');
      setToDelete(null);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Shipping"
        subtitle="Delivery zones and rates for online orders. No zones = free shipping everywhere."
        actions={isOwner ? <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add zone</Button> : undefined}
      />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : !zones?.length ? (
        <EmptyState icon={Truck} title="No shipping zones" description="Until you add a zone, all online orders ship free." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {zones.map((z) => (
            <div key={z._id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{z.name}</span>
                    {!z.active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{MATCH_LABELS[z.matchType]} · {describeMatch(z)}</p>
                </div>
                {isOwner && (
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(z)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setToDelete(z)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {z.rates.length ? z.rates.map((r, i) => <li key={i} className="text-muted-foreground">• {describeRate(r)}</li>) : <li className="text-muted-foreground">No rates — ships free</li>}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing && <ZoneFormDialog zone={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description="Orders to this area will fall back to another matching zone, or become non-serviceable."
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ZoneFormDialog({ zone, onClose }: { zone: ShippingZone | null; onClose: () => void }) {
  const create = useCreateShippingZone();
  const update = useUpdateShippingZone(zone?._id ?? '');
  const [name, setName] = useState(zone?.name ?? '');
  const [matchType, setMatchType] = useState<ZoneMatchType>(zone?.matchType ?? 'all');
  const [states, setStates] = useState((zone?.states ?? []).join(', '));
  const [pincodes, setPincodes] = useState((zone?.pincodePrefixes ?? []).join(', '));
  const [priority, setPriority] = useState(zone?.priority?.toString() ?? '0');
  const [active, setActive] = useState(zone?.active ?? true);
  const [rates, setRates] = useState<ShippingRate[]>(
    zone?.rates?.length ? zone.rates.map((r) => ({ ...r })) : [{ label: 'Standard', price: 0, freeAbove: 0, eta: '' }],
  );

  const setRate = (i: number, patch: Partial<ShippingRate>) => setRates(rates.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRate = () => setRates([...rates, { label: '', price: 0, freeAbove: 0, eta: '' }]);
  const removeRate = (i: number) => setRates(rates.filter((_, idx) => idx !== i));

  const toList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    if (!name.trim()) return toast.error('Zone name is required');
    const cleanRates = rates.filter((r) => r.label.trim());
    if (!cleanRates.length) return toast.error('Add at least one rate');
    const body = {
      name: name.trim(),
      matchType,
      states: matchType === 'states' ? toList(states) : [],
      pincodePrefixes: matchType === 'pincodes' ? toList(pincodes) : [],
      priority: Number(priority) || 0,
      active,
      rates: cleanRates.map((r) => ({
        label: r.label.trim(),
        price: Number(r.price) || 0,
        freeAbove: Number(r.freeAbove) || 0,
        eta: r.eta?.trim() || undefined,
      })),
    };
    try {
      if (zone) await update.mutateAsync(body);
      else await create.mutateAsync(body);
      toast.success(zone ? 'Zone updated' : 'Zone created');
      onClose();
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{zone ? 'Edit zone' : 'Add shipping zone'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Zone name *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Within Maharashtra" />
          </div>
          <div>
            <Label>Applies to</Label>
            <Select value={matchType} onValueChange={(v) => setMatchType(v as ZoneMatchType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(MATCH_LABELS) as ZoneMatchType[]).map((t) => <SelectItem key={t} value={t}>{MATCH_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority (lower wins)</Label>
            <Input inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>
          {matchType === 'states' && (
            <div className="sm:col-span-2">
              <Label>States (comma-separated)</Label>
              <Input value={states} onChange={(e) => setStates(e.target.value)} placeholder="Maharashtra, Gujarat" />
            </div>
          )}
          {matchType === 'pincodes' && (
            <div className="sm:col-span-2">
              <Label>Pincode prefixes (comma-separated)</Label>
              <Input value={pincodes} onChange={(e) => setPincodes(e.target.value)} placeholder="41, 40" />
            </div>
          )}
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between">
            <Label>Rates</Label>
            <Button variant="outline" size="sm" onClick={addRate}><Plus className="h-3.5 w-3.5" /> Add rate</Button>
          </div>
          <div className="mt-2 space-y-2">
            {rates.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-lg border p-2">
                <div className="grid gap-2 sm:grid-cols-4">
                  <div><Label className="text-xs">Label</Label><Input value={r.label} onChange={(e) => setRate(i, { label: e.target.value })} placeholder="Standard" /></div>
                  <div><Label className="text-xs">Price ₹</Label><Input inputMode="numeric" value={String(r.price)} onChange={(e) => setRate(i, { price: Number(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">Free over ₹</Label><Input inputMode="numeric" value={String(r.freeAbove)} onChange={(e) => setRate(i, { freeAbove: Number(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">ETA</Label><Input value={r.eta ?? ''} onChange={(e) => setRate(i, { eta: e.target.value })} placeholder="3–5 days" /></div>
                </div>
                <Button variant="ghost" size="icon" aria-label="Remove rate" onClick={() => removeRate(i)} disabled={rates.length === 1}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </div>

        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" />
          Active
        </label>

        <Button className="mt-2 w-full" onClick={save} disabled={pending}>
          {pending && <Spinner className="h-4 w-4" />} Save
        </Button>
      </DialogContent>
    </Dialog>
  );
}
