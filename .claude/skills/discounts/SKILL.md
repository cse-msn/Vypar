---
name: discounts
description: Work on MNM Fashion discount / coupon codes — the admin management screen, the server-side validation engine, and how a code is applied at storefront checkout. Use for anything about coupons, promo codes, percentage/fixed/free-shipping discounts, or usage limits.
---

# Discount / coupon codes

Coupon codes customers type at checkout. The discount math is **always computed on the server** — a
client can never dictate its own total.

## Model (`backend/src/models/Discount.ts`)
`code` (upper-cased, unique), `description`, `type` (`percentage` | `fixed` | `free_shipping` — see
`DISCOUNT_TYPES` in `constants.ts`), `value`, `minSubtotal`, `maxDiscount` (cap for a percentage code,
0 = none), `usageLimit` (global, 0 = unlimited), `usageCount`, `perCustomerLimit` (0 = unlimited),
`startsAt`/`endsAt`, `active`.

## Engine (`backend/src/services/discounts.ts`)
- `validateDiscount(code, { subtotal, shippingFee, customerId })` → `{ discount, discountAmount, freeShipping }`
  or throws `ApiError.badRequest` with a customer-friendly message. Enforces active, date window, minimum
  subtotal, global usage limit, and (when `customerId` is present) per-customer limit by counting the
  customer's non-cancelled orders with that `discountCode`.
- `computeDiscountAmount(discount, subtotal, shippingFee)` — pure math; percentage is capped by
  `maxDiscount` and never exceeds the subtotal.
- `recordRedemption(code)` — `$inc` the global `usageCount` after an order commits.

## Endpoints
- **Admin** `backend/src/routes/discounts.routes.ts` → `/api/discounts` (`requireAuth`; list is staff,
  mutations are `requireRole('owner')`). Standard `{data,meta}` / `{data}` envelope, pagination, soft
  rules follow the add-endpoint skill. Hard delete (a code is just a lookup).
- **Storefront** `backend/src/routes/store/discounts.routes.ts` → `POST /api/store/discounts/validate`
  (public, `optionalCustomer`) — advisory preview for the cart UI. The authoritative check runs again in
  `createOrder`.

## Order integration (`backend/src/services/orders.ts`)
`createOrder` accepts an optional `discountCode`; it re-validates server-side, recomputes `discount`,
stores `discountCode` + `discount` on the Order, sets `total = subtotal − discount + shippingFee`, and
calls `recordRedemption`. The `Order` model has `discount` and `discountCode` fields.

## Frontend
- Admin page `frontend/src/pages/Discounts.tsx` (nav "Discounts", route `/discounts`), hooks
  `frontend/src/hooks/discounts.ts`, type `Discount` in `types.ts`, query keys `qk.discounts`. Owner-only
  create/edit/delete; staff can view.
- Storefront: `frontend/src/store/pages/Checkout.tsx` has a code field that calls `/discounts/validate`,
  shows the discount line, and passes `discountCode` on the order.

## Not yet wired
In-store **billing** (`services/sales.ts` / Invoice) still uses its own ad-hoc per-bill discount — it does
NOT use this coupon engine yet. Reuse `validateDiscount` there when adding coupon support to billing.
