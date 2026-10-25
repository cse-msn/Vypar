import { useState } from 'react';
import { Plus, Layers, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useCollections, useCreateCollection, useUpdateCollection, useDeleteCollection } from '@/hooks/collections';
import { useAuth } from '@/context/AuthContext';
import { getApiError } from '@/lib/api';
import type { Collection } from '@/types';

export default function Collections() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const { data: collections, isLoading } = useCollections();
  const [editing, setEditing] = useState<Collection | null | 'new'>(null);
  const [toDelete, setToDelete] = useState<Collection | null>(null);
  const del = useDeleteCollection();

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete._id);
      toast.success('Collection deleted');
      setToDelete(null);
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Collections"
        subtitle="Curated groups of products for your online store (e.g. Festive, New Arrivals)."
        actions={isOwner ? <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add collection</Button> : undefined}
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : !collections?.length ? (
        <EmptyState icon={Layers} title="No collections yet" description="Create a collection, then assign products to it from the product form." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <div key={c._id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{c.title}</span>
                    {c.featured && <Badge variant="success">Featured</Badge>}
                    {!c.active && <Badge variant="secondary">Hidden</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">/{c.handle} · {c.productCount ?? 0} products</p>
                </div>
                {isOwner && (
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setToDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
              {c.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
            </div>
          ))}
        </div>
      )}

      {editing && <CollectionFormDialog collection={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`Delete ${toDelete?.title}?`}
        description="Products stay, but they'll be removed from this collection."
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CollectionFormDialog({ collection, onClose }: { collection: Collection | null; onClose: () => void }) {
  const create = useCreateCollection();
  const update = useUpdateCollection(collection?._id ?? '');
  const [form, setForm] = useState({
    title: collection?.title ?? '',
    handle: collection?.handle ?? '',
    description: collection?.description ?? '',
    image: collection?.image ?? '',
    sortOrder: collection?.sortOrder?.toString() ?? '0',
    featured: collection?.featured ?? false,
    active: collection?.active ?? true,
  });

  const save = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    const body = {
      title: form.title.trim(),
      handle: form.handle.trim() || undefined,
      description: form.description.trim() || undefined,
      image: form.image.trim() || undefined,
      sortOrder: Number(form.sortOrder) || 0,
      featured: form.featured,
      active: form.active,
    };
    try {
      if (collection) await update.mutateAsync(body);
      else await create.mutateAsync(body);
      toast.success(collection ? 'Collection updated' : 'Collection created');
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
          <DialogTitle>{collection ? 'Edit collection' : 'Add collection'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label>Title *</Label><Input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Festive Collection" /></div>
          <div>
            <Label>URL handle</Label>
            <Input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="auto from title (e.g. festive-collection)" />
          </div>
          <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Image URL</Label><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://…" /></div>
          <div className="w-28"><Label>Sort order</Label><Input inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></div>
          <div className="flex gap-5">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="h-4 w-4" /> Featured on home</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" /> Active</label>
          </div>
        </div>
        <Button className="mt-2 w-full" onClick={save} disabled={pending}>
          {pending && <Spinner className="h-4 w-4" />} Save
        </Button>
      </DialogContent>
    </Dialog>
  );
}
