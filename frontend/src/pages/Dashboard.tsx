import { Link } from 'react-router-dom';
import { ShoppingCart, Plus, AlertTriangle, ReceiptText, Package } from 'lucide-react';
import { useDashboard } from '@/hooks/reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';

function Stat({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-20" />
      ) : (
        <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      )}
      {sub && !loading && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const payTone = (s: string) => (s === 'paid' ? 'success' : s === 'partial' ? 'warning' : 'destructive');

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboard();
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="space-y-5">
      {/* Hero — today's takings + the one gold action */}
      <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-px w-6 bg-gold" />
              <span className="text-sm opacity-90">Today&rsquo;s sales{firstName ? `, ${firstName}` : ''}</span>
            </div>
            {isLoading ? (
              <Skeleton className="mt-2 h-11 w-48 bg-primary-foreground/20" />
            ) : (
              <p className="mt-1.5 font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
                {formatCurrency(data?.salesToday.total)}
              </p>
            )}
            <p className="mt-2 text-sm opacity-90">
              {data?.salesToday.count
                ? `${data.salesToday.count} bill${data.salesToday.count > 1 ? 's' : ''} so far`
                : 'No bills yet today — make the first sale.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Link to="/billing">
                <ShoppingCart className="h-5 w-5" /> New bill
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/products/new">
                <Plus className="h-5 w-5" /> Add product
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Quiet supporting stats — flat, no shadows (distinct from the hero) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="This month" value={formatCurrency(data?.salesMonth.total)} sub={`${data?.salesMonth.count ?? 0} bills`} loading={isLoading} />
        <Stat label="Receivable" value={formatCurrency(data?.outstandingReceivable)} sub="outstanding dues" loading={isLoading} />
        <Stat label="Products" value={String(data?.productCount ?? 0)} sub="active designs" loading={isLoading} />
        <Stat label="Customers" value={String(data?.customerCount ?? 0)} loading={isLoading} />
      </section>

      {/* The day's work */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="h-4 w-4 text-warning" /> Running low
            </CardTitle>
            {!!data?.lowStockCount && <Badge variant="warning">{data.lowStockCount}</Badge>}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
            ) : !data?.lowStock?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Everything&rsquo;s well stocked.</p>
            ) : (
              <>
                <ul className="divide-y">
                  {data.lowStock.slice(0, 6).map((v) => (
                    <li key={`${v.productId}-${v.color}-${v.size}`} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{v.designNumber}</span>
                        <span className="text-muted-foreground"> · {v.color} / {v.size}</span>
                      </span>
                      <Badge variant={v.quantity === 0 ? 'destructive' : 'warning'}>
                        {v.quantity === 0 ? 'Out of stock' : `${v.quantity} left`}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="link" className="mt-1 h-auto p-0 text-sm">
                  <Link to="/purchases/new">Record a purchase to restock</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-display text-lg font-semibold">Latest bills</CardTitle>
            <Button asChild variant="link" className="h-auto p-0 text-sm">
              <Link to="/invoices">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : !data?.recentInvoices?.length ? (
              <EmptyState
                icon={ReceiptText}
                title="No bills yet"
                description="Create your first bill to get started."
                action={
                  <Button asChild size="sm">
                    <Link to="/billing"><ShoppingCart className="h-4 w-4" /> New bill</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y">
                {data.recentInvoices.map((inv) => (
                  <li key={inv._id}>
                    <Link to={`/invoices/${inv._id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm hover:text-primary">
                      <span className="min-w-0">
                        <span className="font-medium">{inv.invoiceNumber}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {inv.customerSnapshot.name} · {formatDate(inv.date)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="font-semibold">{formatCurrency(inv.total)}</span>
                        <Badge className="ml-2" variant={payTone(inv.paymentStatus)}>
                          {inv.paymentStatus}
                        </Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {data && !isLoading && data.productCount === 0 && (
        <EmptyState
          icon={Package}
          title="Your catalogue is empty"
          description="Add your first design to start billing and tracking stock."
          action={<Button asChild><Link to="/products/new"><Plus className="h-4 w-4" /> Add product</Link></Button>}
        />
      )}
    </div>
  );
}
