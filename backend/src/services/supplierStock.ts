import { Purchase } from '../models/Purchase';
import { Product } from '../models/Product';
import { round2 } from '../utils/money';

export interface SupplierStockLine {
  name: string; // "<product name>-----<colour>-<size>"
  itemCode: string;
  purQty: number;
  purRate: number;
  pAmount: number;
  stockQty: number;
  diff: number; // purchased − in-stock (i.e. sold/moved)
  mrp: number;
  stockAmt: number;
  sold: boolean; // stockQty < purQty → highlight
}

export interface SupplierStockGroup {
  supplier: string;
  date: Date;
  lot: string;
  year: number;
  supplierBillNo?: string;
  lines: SupplierStockLine[];
  totals: { purQty: number; pAmount: number; stockQty: number; diff: number; stockAmt: number };
}

export interface SupplierStockReport {
  generatedAt: Date;
  filters: { supplierId?: string; from?: Date; to?: Date };
  groups: SupplierStockGroup[];
  grand: { purQty: number; pAmount: number; stockQty: number; diff: number; stockAmt: number; lineCount: number };
}

const emptyTotals = () => ({ purQty: 0, pAmount: 0, stockQty: 0, diff: 0, stockAmt: 0 });

/**
 * Build the "Supplier Wise Stock Report": every received purchase batch (supplier + date + lot),
 * each line comparing what was purchased against the variant's current live stock.
 */
export async function buildSupplierStockReport(opts: {
  supplierId?: string;
  from?: Date;
  to?: Date;
} = {}): Promise<SupplierStockReport> {
  const filter: Record<string, unknown> = { status: 'received' };
  if (opts.supplierId) filter.supplier = opts.supplierId;
  if (opts.from || opts.to) {
    filter.date = { ...(opts.from && { $gte: opts.from }), ...(opts.to && { $lte: opts.to }) };
  }

  const purchases = await Purchase.find(filter).populate('supplier', 'name').lean();

  // Current stock + MRP (selling price) + SKU per variant.
  const productIds = [...new Set(purchases.flatMap((p) => p.items.map((i) => String(i.product))))];
  const products = await Product.find({ _id: { $in: productIds } }, { variants: 1, sellingPrice: 1 }).lean();
  const variantMap = new Map<string, { quantity: number; mrp: number; sku: string }>();
  for (const p of products) {
    for (const v of p.variants) {
      variantMap.set(String(v._id), {
        quantity: v.quantity,
        mrp: v.sellingPrice ?? p.sellingPrice ?? 0,
        sku: v.sku,
      });
    }
  }

  // Sort by supplier name, then date, then purchase number (stable, report-friendly order).
  purchases.sort((a, b) => {
    const an = (a.supplier as unknown as { name?: string })?.name ?? '';
    const bn = (b.supplier as unknown as { name?: string })?.name ?? '';
    if (an !== bn) return an.localeCompare(bn);
    const ad = +new Date(a.date);
    const bd = +new Date(b.date);
    if (ad !== bd) return ad - bd;
    return String(a.purchaseNumber).localeCompare(String(b.purchaseNumber));
  });

  const grand = { ...emptyTotals(), lineCount: 0 };

  const groups: SupplierStockGroup[] = purchases.map((p) => {
    const totals = emptyTotals();
    const lines: SupplierStockLine[] = p.items.map((it) => {
      const v = variantMap.get(String(it.variantId));
      const stockQty = v?.quantity ?? 0;
      const mrp = v?.mrp ?? 0;
      const purQty = it.quantity;
      const pAmount = round2(it.costPrice * purQty);
      const stockAmt = round2(stockQty * mrp);
      const line: SupplierStockLine = {
        name: `${it.productName}-----${it.color}-${it.size}`,
        itemCode: v?.sku ?? '',
        purQty,
        purRate: it.costPrice,
        pAmount,
        stockQty,
        diff: purQty - stockQty,
        mrp,
        stockAmt,
        sold: stockQty < purQty,
      };
      totals.purQty += purQty;
      totals.pAmount = round2(totals.pAmount + pAmount);
      totals.stockQty += stockQty;
      totals.diff += line.diff;
      totals.stockAmt = round2(totals.stockAmt + stockAmt);
      return line;
    });

    grand.purQty += totals.purQty;
    grand.pAmount = round2(grand.pAmount + totals.pAmount);
    grand.stockQty += totals.stockQty;
    grand.diff += totals.diff;
    grand.stockAmt = round2(grand.stockAmt + totals.stockAmt);
    grand.lineCount += lines.length;

    const date = new Date(p.date);
    return {
      supplier: (p.supplier as unknown as { name?: string })?.name ?? '—',
      date,
      lot: String(parseInt(String(p.purchaseNumber).replace(/\D/g, ''), 10) || p.purchaseNumber),
      year: date.getFullYear(),
      supplierBillNo: p.supplierBillNo,
      lines,
      totals,
    };
  });

  return { generatedAt: new Date(), filters: opts, groups, grand };
}
