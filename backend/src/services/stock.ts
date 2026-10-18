import { Product } from '../models/Product';
import { ApiError } from '../utils/ApiError';

export interface StockLine {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface StockInLine extends StockLine {
  costPrice?: number;
}

/**
 * Atomically reserve (decrement) stock for a set of lines.
 *
 * Each decrement is a single conditional update guarded by `quantity >= qty`, so the
 * server is the source of truth and overselling is impossible even under concurrency.
 * If any line can't be satisfied, already-applied decrements are compensated (rolled
 * back) and an ApiError.conflict is thrown describing the shortfall. This gives
 * all-or-nothing behaviour without requiring a replica-set transaction.
 */
export async function reserveStock(lines: StockLine[]): Promise<void> {
  const applied: StockLine[] = [];
  for (const line of lines) {
    const res = await Product.updateOne(
      {
        _id: line.productId,
        variants: { $elemMatch: { _id: line.variantId, quantity: { $gte: line.quantity } } },
      },
      { $inc: { 'variants.$.quantity': -line.quantity } },
    );
    if (res.modifiedCount !== 1) {
      await releaseStock(applied); // compensate
      const product = await Product.findById(line.productId, { variants: 1, designNumber: 1, name: 1 }).lean();
      const variant = product?.variants.find((v) => String(v._id) === String(line.variantId));
      throw ApiError.conflict('Insufficient stock to complete this sale', {
        productId: line.productId,
        designNumber: product?.designNumber,
        color: variant?.color,
        size: variant?.size,
        requested: line.quantity,
        available: variant?.quantity ?? 0,
      });
    }
    applied.push(line);
  }
}

/** Increment stock back (used for compensation and for cancelling a confirmed sale). */
export async function releaseStock(lines: StockLine[]): Promise<void> {
  for (const line of lines) {
    await Product.updateOne(
      { _id: line.productId, 'variants._id': line.variantId },
      { $inc: { 'variants.$.quantity': line.quantity } },
    );
  }
}

/** Add stock from a purchase, optionally refreshing the variant's latest cost price. */
export async function addStock(lines: StockInLine[]): Promise<void> {
  for (const line of lines) {
    const update: Record<string, unknown> = { $inc: { 'variants.$.quantity': line.quantity } };
    if (line.costPrice != null) update.$set = { 'variants.$.costPrice': line.costPrice };
    await Product.updateOne(
      { _id: line.productId, 'variants._id': line.variantId },
      update,
    );
  }
}

/**
 * Remove stock safely (used when cancelling a purchase). Fails if any line would push
 * stock negative — e.g. the received goods were already sold — so the caller can refuse.
 */
export async function removeStockSafe(lines: StockLine[]): Promise<void> {
  const applied: StockLine[] = [];
  for (const line of lines) {
    const res = await Product.updateOne(
      {
        _id: line.productId,
        variants: { $elemMatch: { _id: line.variantId, quantity: { $gte: line.quantity } } },
      },
      { $inc: { 'variants.$.quantity': -line.quantity } },
    );
    if (res.modifiedCount !== 1) {
      await addStock(applied);
      throw ApiError.conflict(
        'Cannot cancel: some received items have already been sold and stock would go negative',
      );
    }
    applied.push(line);
  }
}
