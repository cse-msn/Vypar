import { Discount, type DiscountDoc } from '../models/Discount';
import { Order } from '../models/Order';
import { ApiError } from '../utils/ApiError';
import { round2 } from '../utils/money';

export interface DiscountContext {
  subtotal: number;
  shippingFee: number;
  /** Logged-in customer id, used to enforce per-customer usage limits. */
  customerId?: string;
}

export interface AppliedDiscount {
  discount: DiscountDoc;
  /** Rupee amount taken off the order total (never below 0, never above subtotal). */
  discountAmount: number;
  /** True when the code waives the shipping fee. */
  freeShipping: boolean;
}

/**
 * Compute the rupee value of a discount against a cart. Deterministic and side-effect free —
 * all discount math happens on the server so a client can never dictate its own total.
 */
export function computeDiscountAmount(
  discount: DiscountDoc,
  subtotal: number,
  shippingFee: number,
): { discountAmount: number; freeShipping: boolean } {
  if (discount.type === 'free_shipping') {
    return { discountAmount: 0, freeShipping: shippingFee > 0 };
  }
  let amount = discount.type === 'percentage' ? (subtotal * discount.value) / 100 : discount.value;
  if (discount.maxDiscount > 0) amount = Math.min(amount, discount.maxDiscount);
  amount = Math.min(amount, subtotal); // never discount more than the goods are worth
  return { discountAmount: round2(Math.max(0, amount)), freeShipping: false };
}

/**
 * Look up a code, enforce every rule (active, window, minimum, global + per-customer limits),
 * and return the applied discount. Throws ApiError.badRequest with a customer-friendly message
 * when the code can't be used. Used by both the storefront preview and order creation.
 */
export async function validateDiscount(rawCode: string, ctx: DiscountContext): Promise<AppliedDiscount> {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw ApiError.badRequest('Enter a discount code');

  const discount = await Discount.findOne({ code });
  if (!discount || !discount.active) throw ApiError.badRequest('That code is not valid');

  const now = new Date();
  if (discount.startsAt && now < discount.startsAt) throw ApiError.badRequest('That code is not active yet');
  if (discount.endsAt && now > discount.endsAt) throw ApiError.badRequest('That code has expired');

  if (ctx.subtotal < discount.minSubtotal) {
    throw ApiError.badRequest(`Add ₹${round2(discount.minSubtotal - ctx.subtotal)} more to use this code`);
  }

  if (discount.usageLimit > 0 && discount.usageCount >= discount.usageLimit) {
    throw ApiError.badRequest('That code has reached its usage limit');
  }

  if (discount.perCustomerLimit > 0 && ctx.customerId) {
    const used = await Order.countDocuments({
      customer: ctx.customerId,
      discountCode: code,
      status: { $ne: 'cancelled' },
    });
    if (used >= discount.perCustomerLimit) throw ApiError.badRequest('You have already used this code');
  }

  const { discountAmount, freeShipping } = computeDiscountAmount(discount, ctx.subtotal, ctx.shippingFee);
  return { discount, discountAmount, freeShipping };
}

/** Increment the global redemption counter after an order using the code is committed. */
export async function recordRedemption(code: string): Promise<void> {
  await Discount.updateOne({ code: code.trim().toUpperCase() }, { $inc: { usageCount: 1 } });
}
