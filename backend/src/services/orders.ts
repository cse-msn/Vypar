import { Order, type OrderDoc, type IShippingAddress } from '../models/Order';
import { Product } from '../models/Product';
import { nextSequence, formatNumber } from '../models/Counter';
import { reserveStock, releaseStock, type StockLine } from './stock';
import { ApiError } from '../utils/ApiError';
import { round2 } from '../utils/money';
import type { OrderPaymentMethod } from '../constants';

export interface OrderLineInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CreateOrderInput {
  items: OrderLineInput[];
  shippingAddress: IShippingAddress;
  paymentMethod: OrderPaymentMethod;
  notes?: string;
}

/**
 * Place an online order. Prices come from the B2C price (the customer price); stock is
 * reserved atomically (reused from the shop's stock service) so online orders and in-shop
 * sales draw down the same inventory. COD orders are created immediately; online (Razorpay)
 * orders are created pending and confirmed on payment (handled by the payments flow).
 */
export async function createOrder(customerId: string, input: CreateOrderInput): Promise<OrderDoc> {
  if (!input.items?.length) throw ApiError.badRequest('Your cart is empty');

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: productIds }, active: true });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items: OrderDoc['items'] = [];
  const reserve: StockLine[] = [];
  for (const line of input.items) {
    if (!line.quantity || line.quantity < 1) throw ApiError.badRequest('Quantity must be at least 1');
    const product = byId.get(line.productId);
    if (!product) throw ApiError.badRequest('A product in your cart is no longer available');
    const variant = product.variants.id(line.variantId);
    if (!variant) throw ApiError.badRequest('A selected colour/size is no longer available');
    const price = round2(product.b2cPrice ?? product.sellingPrice ?? 0);
    items.push({
      product: product._id,
      variantId: variant._id,
      designNumber: product.designNumber,
      productName: product.name,
      color: variant.color,
      size: variant.size,
      sku: variant.sku,
      quantity: line.quantity,
      price,
      amount: round2(price * line.quantity),
    });
    reserve.push({ productId: String(product._id), variantId: String(variant._id), quantity: line.quantity });
  }

  const subtotal = round2(items.reduce((s, i) => s + i.amount, 0));
  const shippingFee = 0; // flat free shipping for now
  const total = round2(subtotal + shippingFee);

  // Reserve stock first (atomic, all-or-nothing). Throws ApiError.conflict if short.
  await reserveStock(reserve);
  try {
    const seq = await nextSequence('order');
    const order = await Order.create({
      orderNumber: formatNumber('ORD', seq),
      customer: customerId,
      items,
      subtotal,
      shippingFee,
      discount: 0,
      total,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      status: 'placed',
      shippingAddress: input.shippingAddress,
      notes: input.notes,
      placedAt: new Date(),
    });
    return order;
  } catch (err) {
    // Persisting failed — give the reserved stock back.
    await releaseStock(reserve).catch(() => undefined);
    throw err;
  }
}
