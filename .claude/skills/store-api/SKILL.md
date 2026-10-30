---
name: store-api
description: Work on the MNM Fashion customer-facing online store API under /api/store (public catalog, customer accounts, journey analytics, and the planned checkout/orders/payments). Use when adding or changing storefront endpoints, customer auth, or journey tracking.
---

# Online store API (`/api/store`)

The customer-facing store. Lives in `backend/src/routes/store/` and is mounted at `/api/store` by `backend/src/routes/index.ts`. It is **separate from the staff app** and does NOT use `requireAuth`.

## Customer identity (NOT staff tokens)
- **Auth is WhatsApp/phone + OTP** (no email/password). The OTP is the **last 4 digits of the number** —
  a fixed, no-send scheme (no Meta/WhatsApp Business API). `backend/src/utils/phone.ts`
  (`normalizePhone`, `isValidPhone`, `otpForPhone`). ⚠️ Predictable by design — NOT secure; swap in a real
  OTP provider to harden. The number is stored on `Customer.phone` + `Customer.whatsapp` for follow-up.
- Tokens are signed by `backend/src/services/storeAuth.ts` with claim `typ: 'customer'`. (`Customer` still
  has a legacy `passwordHash` field, now unused by the storefront.)
- Guards: `requireCustomer` (must be logged in) and `optionalCustomer` (attach `req.customer` if a valid token is present, else continue — for public/anonymous routes). Both in `backend/src/middleware/customerAuth.ts`.
- A staff/owner token is rejected on store routes and vice-versa.

## Existing endpoints
- `POST /api/store/auth/otp/request` { phone } → `{ sent, isNewCustomer, hint, devOtp? (non-prod only) }`.
  `POST /api/store/auth/otp/verify` { phone, otp, name?, anonymousId? } → upserts the Customer by
  phone/whatsapp and returns `{ token, customer }`. `GET /api/store/auth/me`. (`/shop/register` now just
  redirects to the unified `/shop/login`.)
- `GET /api/store/products` (list) supports `search`, `collection` (handle|id), `inStock`, pagination, a
  `sort` (`newest`|`price_asc`|`price_desc`|`gher`), and **faceted filters**: the string facets in
  `STRING_FACETS` (category, subCategory, gender, dupatta, backOpening, blouseSize, sleeves, backClosure,
  bottomType, sizeGroup, fabric — exact match), plus `gher` (number), `size` (matches `variants.size`) and `color` (matches `variants.color`).
  `GET /api/store/products/filters` returns the distinct values for every facet (for the storefront
  filter dropdowns). `GET /api/store/products/categories`, `GET /api/store/products/:id`. `toPublic()`
  exposes only customer-safe fields + the **B2C price** (`b2cPrice ?? sellingPrice`) and the apparel
  attributes (fabric/dupatta/backOpening/blouseSize/gher/sleeves/backClosure/bottomType) — never
  cost/B2B/supplier/HSN. The storefront UI is the filter panel + sort dropdown in `store/pages/Home.tsx`.
- `POST /api/store/events` — journey ingest (public, `optionalCustomer`). Batch of events with an `anonymousId`.
- `POST /api/store/orders` · `GET /api/store/orders` · `GET /api/store/orders/:id` (`requireCustomer`). Create reserves
  stock via `services/orders.ts` → `createOrder` (prices from B2C, reuses `reserveStock`; COD now, Razorpay later).

## Journey analytics
- `StoreEvent` model (`backend/src/models/StoreEvent.ts`), event types in `constants.ts` (`STORE_EVENT_TYPES`): page_view, view_product, search, add_to_cart, remove_from_cart, begin_checkout, purchase, signup, login.
- **Identity stitching:** anonymous events carry `anonymousId`; on register/login `stitchAnonymousEvents` (`backend/src/services/storeEvents.ts`) back-fills `customer` onto prior events.
- Owner views a customer's journey via `GET /api/customers/:id/journey` (staff route; counts by type + an `abandonedCart` flag).

## Storefront UI (built)
Customer-facing site at **`/shop`** (public routes, same app, outside the admin Layout) in `frontend/src/store/`:
`StoreApp.tsx` (routes), `StoreAuthContext` (customer token `store_token` + `anonymousId`), `CartContext`
(localStorage cart), `lib/storeApi.ts` (axios at `/api/store` + `trackEvent`), pages Home/Product/Cart/Checkout/
Login/Register/Orders. Mounted in `App.tsx` as `/shop/*`. Prices shown are B2C. Journey events fire on view/
search/add_to_cart/begin_checkout/purchase.

## Admin online-orders view (built)
Staff/owner manage online orders at **/orders** (`frontend/src/pages/Orders.tsx`, nav "Online Orders") via admin API
`GET/PATCH /api/orders` + `POST /api/orders/:id/cancel` (`backend/src/routes/orders.routes.ts`). Update fulfilment
status (placed→…→delivered; delivered auto-marks a COD order paid); cancel returns stock (`cancelOrder`).

## Payments & discounts (built)
- **Razorpay online payment** is built — see the `payments-online` skill. `POST /orders` returns a `payment`
  payload for online orders; `POST /orders/:id/verify` + `POST /razorpay/webhook` confirm it; `GET /config`
  tells the UI whether online is enabled. COD still works with no config.
- **Coupon codes** — see the `discounts` skill. `POST /api/store/discounts/validate` previews a code;
  `createOrder` re-validates server-side.

## Planned (not built yet) — see MEMORY `storefront-ecommerce-build`
Storefront UI polish; shipping rates; GST tax engine; collections; gift cards. Refunds via Razorpay API are
not wired yet.

## Conventions
Follow the same envelope as the rest of the API: lists `{ data, meta }`, single `{ data }`. Online orders must reduce inventory through `backend/src/services/stock.ts`, never ad-hoc. Never expose cost/B2B/supplier data on public routes.
