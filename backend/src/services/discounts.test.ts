import { describe, it, expect } from 'vitest';
import { computeDiscountAmount } from './discounts';
import type { DiscountDoc } from '../models/Discount';

// Minimal stand-in — computeDiscountAmount only reads type/value/maxDiscount.
const make = (over: Partial<DiscountDoc>): DiscountDoc => ({ value: 0, maxDiscount: 0, ...over } as DiscountDoc);

describe('computeDiscountAmount', () => {
  it('takes a percentage off the subtotal', () => {
    const r = computeDiscountAmount(make({ type: 'percentage', value: 10 }), 1000, 0);
    expect(r).toEqual({ discountAmount: 100, freeShipping: false });
  });

  it('caps a percentage discount at maxDiscount', () => {
    const r = computeDiscountAmount(make({ type: 'percentage', value: 50, maxDiscount: 200 }), 1000, 0);
    expect(r.discountAmount).toBe(200);
  });

  it('applies a fixed amount off', () => {
    const r = computeDiscountAmount(make({ type: 'fixed', value: 150 }), 1000, 0);
    expect(r.discountAmount).toBe(150);
  });

  it('never discounts more than the subtotal', () => {
    const r = computeDiscountAmount(make({ type: 'fixed', value: 5000 }), 1000, 0);
    expect(r.discountAmount).toBe(1000);
  });

  it('waives shipping for a free_shipping code only when there is a fee', () => {
    expect(computeDiscountAmount(make({ type: 'free_shipping' }), 1000, 50)).toEqual({ discountAmount: 0, freeShipping: true });
    expect(computeDiscountAmount(make({ type: 'free_shipping' }), 1000, 0)).toEqual({ discountAmount: 0, freeShipping: false });
  });
});
