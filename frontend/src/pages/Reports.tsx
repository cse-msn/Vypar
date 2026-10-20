import { useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp, Boxes, Wallet, FileText, Download, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  useSalesReport,
  useInventoryReport,
  useFinancialReport,
  useSupplierStockReport,
  supplierStockPdfPath,
  useStockListReport,
  stockListPdfPath,
} from '@/hooks/reports';
import { useSuppliers } from '@/hooks/suppliers';
import { openPdf } from '@/lib/pdf';
import { getApiError } from '@/lib/api';
import { formatCurrency, formatNumber, paymentMethodLabel } from '@/lib/format';

type Tab = 'sales' | 'inventory' | 'financial' | 'supplier' | 'stocklist';
const TAB_LABELS: Record<Tab, string> = {
  sales: 'Sales',
  inventory: 'Inventory',
  financial: 'Financial',
  supplier: 'Supplier stock',
  stocklist: 'Stock list',
};
const PRIMARY = 'hsl(334 69% 38%)'; // rani-berry, matches the brand token

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const [tab, setTab] = useState<Tab>('sales');
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const range = { from: from || undefined, to: to || undefined };

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales, inventory and financial insights." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-lg border p-1">
          {(['sales', 'inventory', 'financial', 'supplier', 'stocklist'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium', tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
        {(tab === 'sales' || tab === 'financial' || tab === 'supplier') && (
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
          </div>
        )}
      </div>

      {tab === 'sales' && <SalesTab range={range} />}
      {tab === 'inventory' && <InventoryTab />}
      {tab === 'financial' && <FinancialTab range={range} />}
      {tab === 'supplier' && <SupplierStockTab range={range} />}
      {tab === 'stocklist' && <StockListTab />}
    </div>
  );
}

function StockListTab() {
  const [search, setSearch] = useState('');
  const params = { search: search || undefined };
  const { data, isLoading } = useStockListReport(params);

  const open = (mode: 'view' | 'download') =>
    openPdf(stockListPdfPath(params), 'stock-list.pdf', mode).catch((e) => toast.error(getApiError(e).message));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4" /> Stock List (design-wise)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-xs" placeholder="Filter by design no, name or item code…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button onClick={() => open('view')}><FileText className="h-4 w-4" /> View PDF</Button>
            <Button variant="outline" onClick={() => open('download')}><Download className="h-4 w-4" /> Download PDF</Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Designs" value={formatNumber(data?.totals.designs ?? 0)} />
              <Tile label="Variants" value={formatNumber(data?.totals.variants ?? 0)} />
              <Tile label="Units in stock" value={formatNumber(data?.totals.units ?? 0)} />
              <Tile label="Stock value (MRP)" value={formatCurrency(data?.totals.value ?? 0)} />
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && data && data.rows.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
          <CardContent>
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Design No</TableHead>
                    <TableHead>Design Code</TableHead>
                    <TableHead>Design Name</TableHead>
                    <TableHead>Colour / Size</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.slice(0, 50).map((r) => (
                    <TableRow key={r.itemCode}>
                      <TableCell>{r.designNumber}</TableCell>
                      <TableCell className="font-medium">{r.designCode}</TableCell>
                      <TableCell>{r.designName}</TableCell>
                      <TableCell className="text-muted-foreground">{r.color} / {r.size}</TableCell>
                      <TableCell>{r.itemCode}</TableCell>
                      <TableCell className={`text-right ${r.stock <= 0 ? 'text-destructive' : ''}`}>{formatNumber(r.stock)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.mrp)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
            {data.rows.length > 50 && <p className="mt-2 text-xs text-muted-foreground">Showing first 50 of {data.rows.length} rows — the PDF has them all.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SupplierStockTab({ range }: { range: { from?: string; to?: string } }) {
  const [supplier, setSupplier] = useState('');
  const { data: suppliers } = useSuppliers({ limit: 100 });
  const params = { supplier: supplier || undefined, from: range.from, to: range.to };
  const { data, isLoading } = useSupplierStockReport(params);

  const open = (mode: 'view' | 'download') =>
    openPdf(supplierStockPdfPath(params), 'supplier-wise-stock.pdf', mode).catch((e) => toast.error(getApiError(e).message));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4" /> Supplier Wise Stock Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px]">
              <Label className="text-xs">Supplier</Label>
              <Combobox
                value={supplier}
                onValueChange={setSupplier}
                options={[
                  { value: '', label: 'All suppliers' },
                  ...(suppliers?.data ?? []).map((s) => ({ value: s._id, label: s.name })),
                ]}
                placeholder="All suppliers"
                searchPlaceholder="Search suppliers…"
                emptyText="No suppliers found"
              />
            </div>
            <div className="text-xs text-muted-foreground">Date filters (above) apply to purchase dates.</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => open('view')}><FileText className="h-4 w-4" /> View PDF</Button>
            <Button variant="outline" onClick={() => open('download')}><Download className="h-4 w-4" /> Download PDF</Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Purchase batches" value={formatNumber(data?.groups.length ?? 0)} sub={`${data?.grand.lineCount ?? 0} item lines`} />
              <Tile label="Purchased qty" value={formatNumber(data?.grand.purQty ?? 0)} />
              <Tile label="In-stock qty" value={formatNumber(data?.grand.stockQty ?? 0)} />
              <Tile label="Stock value (MRP)" value={formatCurrency(data?.grand.stockAmt ?? 0)} />
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && data && data.groups.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Preview by supplier batch</CardTitle></CardHeader>
          <CardContent>
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Pur. Qty</TableHead>
                    <TableHead className="text-right">Stock Qty</TableHead>
                    <TableHead className="text-right">Stock Amt.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.groups.map((g, i) => (
                    <TableRow key={`${g.supplier}-${g.lot}-${i}`}>
                      <TableCell className="font-medium">{g.supplier}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(g.date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell className="text-right">{g.lines.length}</TableCell>
                      <TableCell className="text-right">{formatNumber(g.totals.purQty)}</TableCell>
                      <TableCell className="text-right">{formatNumber(g.totals.stockQty)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(g.totals.stockAmt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SalesTab({ range }: { range: { from?: string; to?: string } }) {
  const { data, isLoading } = useSalesReport(range);
  if (isLoading || !data) return <Skeleton className="h-64" />;
  const chart = data.daily.map((d) => ({ date: d.date.slice(5), total: d.total }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Total sales" value={formatCurrency(data.summary.totalSales)} sub={`${data.summary.invoiceCount} bills`} />
        <Tile label="Collected" value={formatCurrency(data.summary.totalCollected)} />
        <Tile label="Outstanding" value={formatCurrency(data.summary.totalOutstanding)} />
        <Tile label="Units sold" value={formatNumber(data.summary.unitsSold)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Daily sales</CardTitle></CardHeader>
        <CardContent>
          {chart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No sales in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="total" fill={PRIMARY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">By payment method</CardTitle></CardHeader>
        <CardContent>
          {data.byMethod.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No data.</p>
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Bills</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byMethod.map((m) => (
                    <TableRow key={m.method}>
                      <TableCell className="font-medium">{paymentMethodLabel(m.method)}</TableCell>
                      <TableCell className="text-right">{m.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.total)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.collected)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Top products</CardTitle></CardHeader>
        <CardContent>
          {data.topProducts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No data.</p>
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Design</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProducts.map((p) => (
                    <TableRow key={p.designNumber + p.productName}>
                      <TableCell className="font-medium">{p.designNumber}</TableCell>
                      <TableCell>{p.productName}</TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryTab() {
  const { data, isLoading } = useInventoryReport();
  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Total units" value={formatNumber(data.summary.totalUnits)} sub={`${data.summary.variantCount} variants`} />
        <Tile label="Stock value (cost)" value={formatCurrency(data.summary.costValue)} />
        <Tile label="Stock value (retail)" value={formatCurrency(data.summary.retailValue)} />
        <Tile label="Out of stock" value={formatNumber(data.summary.outOfStock)} sub={`${data.summary.lowStockCount} low`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4" /> Low / out of stock</CardTitle></CardHeader>
        <CardContent>
          {data.lowStock.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Everything is well stocked 🎉</p>
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Design</TableHead><TableHead>Colour / Size</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Threshold</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {data.lowStock.map((v) => (
                    <TableRow key={v.productId + v.color + v.size}>
                      <TableCell className="font-medium">{v.designNumber}</TableCell>
                      <TableCell>{v.color} / {v.size}</TableCell>
                      <TableCell className="text-right"><Badge variant={v.quantity === 0 ? 'destructive' : 'warning'}>{v.quantity}</Badge></TableCell>
                      <TableCell className="text-right text-muted-foreground">{v.threshold}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FinancialTab({ range }: { range: { from?: string; to?: string } }) {
  const { data, isLoading } = useFinancialReport(range);
  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label="Sales (period)" value={formatCurrency(data.periodSales)} sub={`${data.periodSalesCount} bills`} />
        <Tile label="Received (period)" value={formatCurrency(data.periodPaymentsReceived)} />
        <Tile label="Purchases (period)" value={formatCurrency(data.periodPurchases)} sub={`${data.periodPurchaseCount} purchases`} />
        <Tile label="Receivable (now)" value={formatCurrency(data.outstandingReceivable)} />
        <Tile label="Payable (now)" value={formatCurrency(data.outstandingPayable)} />
        <Tile label="Collected at billing" value={formatCurrency(data.periodSalesCollected)} />
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" /> Notes</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Receivable and payable are current outstanding totals across all time. Period figures use the selected date range.
        </CardContent>
      </Card>
    </div>
  );
}
