import { Purchase, type PurchaseDoc } from '../models/Purchase';
import { Product } from '../models/Product';
import { Supplier } from '../models/Supplier';
import { nextSequence, formatNumber } from '../models/Counter';
import { addStock, removeStockSafe, type StockInLine, type StockLine } from './stock';
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

/**
 * Edit an existing (non-cancelled) purchase. Stock is reconciled by the NET change per
 * variant — increases add stock, decreases remove it safely (refused if the reduction
 * would push a variant negative, e.g. those goods were already sold). The supplier's
 * payable balance is adjusted by the difference, moving it between suppliers if changed.
 * The purchaseNumber and status are preserved.
 */
export async function updatePurchase(
  purchaseId: string,
  input: CreatePurchaseInput,
  _user?: { id: string },
): Promise<PurchaseDoc> {
  if (!input.items?.length) throw ApiError.badRequest('A purchase needs at least one item');

  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) throw ApiError.notFound('Purchase not found');
  if (purchase.status === 'cancelled') throw ApiError.badRequest('A cancelled purchase cannot be edited');

  const newSupplier = await Supplier.findById(input.supplierId);
  if (!newSupplier) throw ApiError.notFound('Supplier not found');

  // Build + validate the new line items (same rules as createPurchase).
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: productIds } });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items: PurchaseDoc['items'] = [];
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
  }

  // Net stock delta per product+variant (old purchase vs. new lines).
  const keyOf = (productId: string, variantId: string) => `${productId}:${variantId}`;
  const oldQty = new Map<string, number>();
  for (const i of purchase.items) {
    const k = keyOf(String(i.product), String(i.variantId));
    oldQty.set(k, (oldQty.get(k) ?? 0) + i.quantity);
  }
  const newQty = new Map<string, number>();
  for (const i of items) {
    const k = keyOf(String(i.product), String(i.variantId));
    newQty.set(k, (newQty.get(k) ?? 0) + i.quantity);
  }
  const increases: StockLine[] = [];
  const decreases: StockLine[] = [];
  for (const k of new Set([...oldQty.keys(), ...newQty.keys()])) {
    const [productId, variantId] = k.split(':');
    const delta = (newQty.get(k) ?? 0) - (oldQty.get(k) ?? 0);
    if (delta > 0) increases.push({ productId, variantId, quantity: delta });
    else if (delta < 0) decreases.push({ productId, variantId, quantity: -delta });
  }

  // Risky op first: all-or-nothing, so if a decrease can't be satisfied nothing is applied.
  await removeStockSafe(decreases);
  try {
    await addStock(increases);
  } catch (err) {
    await addStock(decreases).catch(() => undefined); // restore what we removed
    throw err;
  }
  // Refresh each line's variant to this purchase's latest cost (quantity 0 = cost only).
  await addStock(items.map((i) => ({ productId: String(i.product), variantId: String(i.variantId), quantity: 0, costPrice: i.costPrice })));

  // Totals.
  const subtotal = round2(items.reduce((s, i) => s + i.amount, 0));
  const discount = clamp(round2(input.discount ?? 0), 0, subtotal);
  const tax = round2(input.tax ?? 0);
  const total = round2(subtotal - discount + tax);
  const amountPaid = clamp(round2(input.amountPaid ?? 0), 0, total);
  const balance = round2(total - amountPaid);

  // Move the payable: reverse the old balance off the old supplier, apply the new one.
  const oldSupplierId = String(purchase.supplier);
  if (oldSupplierId === String(newSupplier._id)) {
    newSupplier.balance = round2(newSupplier.balance - purchase.balance + balance);
  } else {
    await Supplier.updateOne({ _id: oldSupplierId }, { $inc: { balance: -purchase.balance } });
    newSupplier.balance = round2(newSupplier.balance + balance);
  }
  await newSupplier.save();

  purchase.supplier = newSupplier._id;
  purchase.supplierBillNo = input.supplierBillNo;
  if (input.date) purchase.date = input.date;
  purchase.items = items;
  purchase.subtotal = subtotal;
  purchase.discount = discount;
  purchase.tax = tax;
  purchase.total = total;
  purchase.amountPaid = amountPaid;
  purchase.balance = balance;
  purchase.notes = input.notes;
  await purchase.save();
  return purchase;
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
