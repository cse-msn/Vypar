import { Order, type OrderDoc, type IShippingAddress } from '../models/Order';
import { Product } from '../models/Product';
import { nextSequence, formatNumber } from '../models/Counter';
import { reserveStock, releaseStock, type StockLine } from './stock';
import { validateDiscount, recordRedemption } from './discounts';
import { resolveShippingFee } from './shipping';
import { createRazorpayOrder, isRazorpayConfigured, verifyPaymentSignature } from './razorpay';
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
  /** Optional coupon code; re-validated on the server, client-supplied totals are ignored. */
  discountCode?: string;
  /** Chosen shipping option id (`zoneId:rateId`); the fee is recomputed server-side. */
  shippingRateId?: string;
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

  // Shipping fee is resolved on the server from the configured zones + the destination.
  const shipping = await resolveShippingFee(input.shippingRateId, input.shippingAddress, subtotal);
  let shippingFee = shipping.fee;
  const shippingMethod = shipping.method;

  // Re-validate any coupon on the server and recompute the discount — never trust a client total.
  let discount = 0;
  let discountCode: string | undefined;
  if (input.discountCode?.trim()) {
    const applied = await validateDiscount(input.discountCode, { subtotal, shippingFee, customerId });
    discount = applied.discountAmount;
    if (applied.freeShipping) shippingFee = 0;
    discountCode = applied.discount.code;
  }

  const total = round2(Math.max(0, subtotal - discount + shippingFee));

  if (input.paymentMethod === 'online' && !isRazorpayConfigured()) {
    throw ApiError.badRequest('Online payment is not available right now. Please choose Cash on Delivery.');
  }

  // Reserve stock first (atomic, all-or-nothing). Throws ApiError.conflict if short.
  await reserveStock(reserve);
  try {
    const seq = await nextSequence('order');
    const orderNumber = formatNumber('ORD', seq);

    // For online payment, open a Razorpay order up front; its id links the gateway payment back.
    let razorpayOrderId: string | undefined;
    if (input.paymentMethod === 'online') {
      const rzp = await createRazorpayOrder(total, orderNumber);
      razorpayOrderId = rzp.id;
    }

    const order = await Order.create({
      orderNumber,
      customer: customerId,
      items,
      subtotal,
      shippingFee,
      shippingMethod,
      discount,
      discountCode,
      total,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      status: 'placed',
      shippingAddress: input.shippingAddress,
      notes: input.notes,
      razorpayOrderId,
      placedAt: new Date(),
    });
    if (discountCode) await recordRedemption(discountCode).catch(() => undefined);
    return order;
  } catch (err) {
    // Persisting failed — give the reserved stock back.
    await releaseStock(reserve).catch(() => undefined);
    throw err;
  }
}

/**
 * Confirm an online order once Razorpay returns a signed success to the browser. The signature is
 * cryptographic proof from Razorpay (not a browser-trusted flag). Idempotent: a second call on an
 * already-paid order is a no-op. Returns the updated order.
 */
export async function confirmOnlinePayment(
  orderId: string,
  customerId: string,
  payment: { razorpayPaymentId: string; razorpaySignature: string },
): Promise<OrderDoc> {
  const order = await Order.findOne({ _id: orderId, customer: customerId });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.paymentStatus === 'paid') return order; // idempotent
  if (!order.razorpayOrderId) throw ApiError.badRequest('This order has no online payment to confirm');

  const ok = verifyPaymentSignature(order.razorpayOrderId, payment.razorpayPaymentId, payment.razorpaySignature);
  if (!ok) throw ApiError.badRequest('Payment could not be verified');

  order.paymentStatus = 'paid';
  order.status = 'confirmed';
  order.razorpayPaymentId = payment.razorpayPaymentId;
  order.razorpaySignature = payment.razorpaySignature;
  await order.save();
  return order;
}

/** Mark an order paid from a verified webhook (authoritative, idempotent). */
export async function markOrderPaidByRazorpayOrderId(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<void> {
  const order = await Order.findOne({ razorpayOrderId });
  if (!order || order.paymentStatus === 'paid') return;
  order.paymentStatus = 'paid';
  if (order.status === 'placed') order.status = 'confirmed';
  order.razorpayPaymentId = razorpayPaymentId;
  await order.save();
}

/** Cancel an order and return its reserved stock to inventory. */
export async function cancelOrder(orderId: string): Promise<OrderDoc> {
  const order = await Order.findById(orderId);
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status === 'cancelled') throw ApiError.badRequest('Order is already cancelled');
  await releaseStock(
    order.items.map((i) => ({ productId: String(i.product), variantId: String(i.variantId), quantity: i.quantity })),
  );
  order.status = 'cancelled';
  order.cancelledAt = new Date();
  await order.save();
  return order;
}
