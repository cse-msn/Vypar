import { useNavigate } from 'react-router-dom';
import { FileClock, Trash2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDrafts, useDeleteDraft } from '@/hooks/drafts';
import { getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

function when(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function Drafts() {
  const { data, isLoading } = useDrafts();
  const del = useDeleteDraft();
  const navigate = useNavigate();

  const open = (id: string) => navigate(`/billing?draft=${id}`);
  const remove = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast.success('Draft deleted');
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div>
      <PageHeader title="Drafts" subtitle="Unfinished bills, auto-saved every couple of minutes until you finalise them." />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={FileClock}
          title="No drafts yet"
          description="Bills you start on New Bill are saved here automatically until you Save & Share them."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((d) => (
            <Card key={d._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => open(d._id)} className="min-w-0 text-left">
                    <p className="truncate font-semibold hover:text-primary">{d.customerName || 'Walk-in Customer'}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.itemCount} item{d.itemCount === 1 ? '' : 's'} · {when(d.updatedAt)}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete draft"
                    onClick={() => remove(d._id)}
                    disabled={del.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold">{formatCurrency(d.total)}</span>
                  <Button size="sm" onClick={() => open(d._id)}>
                    <ShoppingCart className="h-4 w-4" /> Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
