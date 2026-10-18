import { Purchase, type PurchaseDoc } from '../models/Purchase';
import { Product } from '../models/Product';
import { Supplier } from '../models/Supplier';
import { nextSequence, formatNumber } from '../models/Counter';
import { addStock, removeStockSafe, type StockInLine } from './stock';
import { ApiError } from '../utils/ApiError';
import { round2, clamp } from '../utils/money';

export interface PurchaseLineInput {
  productId: string;
  variantId: string;
  quantity: number;
  costPrice: number;
}

export interface CreatePurchaseInput {
  supplierId: string;
  supplierBillNo?: string;
  date?: Date;
  items: PurchaseLineInput[];
  discount?: number;
  tax?: number;
  amountPaid?: number;
  notes?: string;
}

export async function createPurchase(
  input: CreatePurchaseInput,
  user?: { id: string },
): Promise<PurchaseDoc> {
  if (!input.items?.length) throw ApiError.badRequest('A purchase needs at least one item');

  const supplier = await Supplier.findById(input.supplierId);
  if (!supplier) throw ApiError.notFound('Supplier not found');

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: productIds } });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items: PurchaseDoc['items'] = [];
  const stockIn: StockInLine[] = [];
  for (const line of input.items) {
    if (!line.quantity || line.quantity < 1) throw ApiError.badRequest('Quantity must be at least 1');
    const product = byId.get(line.productId);
    if (!product) throw ApiError.badRequest(`Product not found: ${line.productId}`);
    const variant = product.variants.id(line.variantId);
    if (!variant) throw ApiError.badRequest(`Variant not found in design ${product.designNumber}`);
    const costPrice = round2(line.costPrice);
    items.push({
      product: product._id,
      variantId: variant._id,
      designNumber: product.designNumber,
      productName: product.name,
      color: variant.color,
      size: variant.size,
      quantity: line.quantity,
      costPrice,
      amount: round2(costPrice * line.quantity),
    });
    stockIn.push({ productId: String(product._id), variantId: String(variant._id), quantity: line.quantity, costPrice });
  }

  const subtotal = round2(items.reduce((s, i) => s + i.amount, 0));
  const discount = clamp(round2(input.discount ?? 0), 0, subtotal);
  const tax = round2(input.tax ?? 0);
  const total = round2(subtotal - discount + tax);
  const amountPaid = clamp(round2(input.amountPaid ?? 0), 0, total);
  const balance = round2(total - amountPaid);

  // Receiving goods increases stock and refreshes each variant's latest cost.
  await addStock(stockIn);

  try {
    const seq = await nextSequence('purchase');
    const purchase = await Purchase.create({
      purchaseNumber: formatNumber('PUR', seq),
      supplier: supplier._id,
      supplierBillNo: input.supplierBillNo,
      date: input.date ?? new Date(),
      items,
      subtotal,
      discount,
      tax,
      total,
      amountPaid,
      balance,
      status: 'received',
      notes: input.notes,
      createdBy: user?.id,
    });
    supplier.balance = round2(supplier.balance + balance);
    await supplier.save();
    return purchase;
  } catch (err) {
    // Compensate the stock increment if persisting the purchase failed.
    await removeStockSafe(stockIn).catch(() => undefined);
    throw err;
  }
}

export async function cancelPurchase(purchaseId: string, user?: { id: string }): Promise<PurchaseDoc> {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) throw ApiError.notFound('Purchase not found');
  if (purchase.status === 'cancelled') throw ApiError.badRequest('Purchase is already cancelled');

  // Remove the received stock; refuses if items were already sold.
  await removeStockSafe(
    purchase.items.map((i) => ({
      productId: String(i.product),
      variantId: String(i.variantId),
      quantity: i.quantity,
    })),
  );

  if (purchase.balance > 0) {
    await Supplier.updateOne({ _id: purchase.supplier }, { $inc: { balance: -purchase.balance } });
  }

  purchase.status = 'cancelled';
  purchase.cancelledAt = new Date();
  if (user?.id) purchase.cancelledBy = user.id as unknown as PurchaseDoc['cancelledBy'];
  await purchase.save();
  return purchase;
}
