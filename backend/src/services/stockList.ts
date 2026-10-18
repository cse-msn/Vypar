import { Product } from '../models/Product';
import { round2 } from '../utils/money';
import { escapeRegex } from '../utils/regex';

export interface StockListRow {
  designNumber: string;
  designCode: number;
  designName: string;
  category: string;
  color: string;
  size: string;
  itemCode: string;
  stock: number;
  mrp: number;
  value: number;
}

export interface StockListReport {
  generatedAt: Date;
  filters: { search?: string; category?: string; includeOutOfStock: boolean };
  rows: StockListRow[];
  totals: { units: number; value: number; variants: number; designs: number };
}

/**
 * Design-wise stock list: one row per variant with its design code, design name,
 * item code, current stock, MRP and stock value.
 */
export async function buildStockListReport(
  opts: { search?: string; category?: string; includeOutOfStock?: boolean } = {},
): Promise<StockListReport> {
  const includeOutOfStock = opts.includeOutOfStock ?? true;
  const filter: Record<string, unknown> = { active: true };
  if (opts.category) filter.category = opts.category;
  if (opts.search) {
    const rx = new RegExp(escapeRegex(opts.search), 'i');
    filter.$or = [{ designNumber: rx }, { name: rx }, { brand: rx }, { 'variants.sku': rx }];
  }

  const products = await Product.find(filter).sort({ code: 1 }).lean();

  const rows: StockListRow[] = [];
  const totals = { units: 0, value: 0, variants: 0, designs: 0 };
  for (const p of products) {
    let designHadRow = false;
    for (const v of p.variants) {
      if (!includeOutOfStock && v.quantity <= 0) continue;
      const mrp = v.sellingPrice ?? p.sellingPrice ?? 0;
      const value = round2(v.quantity * mrp);
      rows.push({
        designNumber: p.designNumber,
        designCode: p.code,
        designName: p.name,
        category: p.category ?? '',
        color: v.color,
        size: v.size,
        itemCode: v.sku,
        stock: v.quantity,
        mrp,
        value,
      });
      totals.units += v.quantity;
      totals.value = round2(totals.value + value);
      totals.variants += 1;
      designHadRow = true;
    }
    if (designHadRow) totals.designs += 1;
  }

  return { generatedAt: new Date(), filters: { ...opts, includeOutOfStock }, rows, totals };
}
