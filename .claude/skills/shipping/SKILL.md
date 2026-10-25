---
name: shipping
description: Work on MNM Fashion storefront shipping — delivery zones, rates, free-shipping thresholds, serviceability, and how the shipping fee is computed at checkout. Use for anything about delivery charges, shipping zones/rates, pincode/state serviceability, or the Shipping admin screen.
---

# Shipping (storefront delivery)

Delivery zones + rates for online orders. The fee is **always recomputed on the server** from the
configured zones and the destination — a client-supplied price is never trusted.

## Model (`backend/src/models/ShippingZone.ts`)
A **zone** = `name`, `matchType` (`all` | `states` | `pincodes`), `states[]`, `pincodePrefixes[]`,
`priority` (lower checked first; first match wins), `active`, and a subdoc array of **rates**
(`label`, `price`, `freeAbove` [₹ threshold for free, 0 = never], `eta`). Rates are a
`Types.DocumentArray` so `zone.rates.id(rateId)` works.

## Service (`backend/src/services/shipping.ts`)
- `quoteShipping({ state, pincode }, subtotal)` → `ShippingOption[]` (`{ id: "zoneId:rateId", label,
  price, eta }`). **No zones configured ⇒ one free "Standard" option** (sensible default). Zones exist but
  none match ⇒ `[]` (not serviceable).
- `resolveShippingFee(shippingRateId, dest, subtotal)` → `{ fee, method }`, recomputed server-side;
  throws `ApiError.badRequest("…don't deliver to this address yet")` when the address isn't serviceable.
  A missing id falls back to the cheapest serviceable option.
- `effectivePrice(rate, subtotal)` applies the `freeAbove` threshold.

## Endpoints
- **Admin** `backend/src/routes/shipping.routes.ts` → `/api/shipping` (`requireAuth`; mutations
  `requireRole('owner')`). List returns all zones `{ data: [...] }` (not paginated).
- **Storefront** `backend/src/routes/store/shipping.routes.ts` → `POST /api/store/shipping/quote`
  (public).

## Order integration (`backend/src/services/orders.ts`)
`createOrder` takes `shippingRateId`, calls `resolveShippingFee`, stores `shippingFee` + `shippingMethod`
on the Order (model has both). A `free_shipping` coupon then zeroes the fee. `total = subtotal − discount
+ shippingFee`.

## Frontend
- Admin page `frontend/src/pages/Shipping.tsx` (nav "Shipping", route `/shipping`), hooks
  `frontend/src/hooks/shipping.ts`, types `ShippingZone`/`ShippingRate` in `types.ts`, key `qk.shipping`.
  Owner-only edits; dynamic rate rows.
- Storefront `frontend/src/store/pages/Checkout.tsx` fetches `/shipping/quote` (debounced on
  state/pincode/subtotal), shows options when >1, adds the shipping line, blocks placing when not
  serviceable, and sends `shippingRateId`.

## Gaps
No weight-based rates (products have no reliable weight). No carrier integration (Shiprocket etc.) —
fulfilment/tracking is manual on the admin order.
