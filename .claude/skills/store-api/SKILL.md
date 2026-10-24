---
name: store-api
description: Work on the MNM Fashion customer-facing online store API under /api/store (public catalog, customer accounts, journey analytics, and the planned checkout/orders/payments). Use when adding or changing storefront endpoints, customer auth, or journey tracking.
---

# Online store API (`/api/store`)

The customer-facing store. Lives in `backend/src/routes/store/` and is mounted at `/api/store` by `backend/src/routes/index.ts`. It is **separate from the staff app** and does NOT use `requireAuth`.

## Customer identity (NOT staff tokens)
- `Customer` model has a `passwordHash` (self-registration). Tokens are signed by `backend/src/services/storeAuth.ts` with claim `typ: 'customer'`.
- Guards: `requireCustomer` (must be logged in) and `optionalCustomer` (attach `req.customer` if a valid token is present, else continue — for public/anonymous routes). Both in `backend/src/middleware/customerAuth.ts`.
- A staff/owner token is rejected on store routes and vice-versa.

## Existing endpoints
- `POST /api/store/auth/register` · `POST /api/store/auth/login` · `GET /api/store/auth/me`. Register/login accept an optional `anonymousId` to stitch a pre-login journey (see below).
- `GET /api/store/products` (list; `search`, `category`, `inStock`, pagination), `GET /api/store/products/categories`, `GET /api/store/products/:id`. These use `toPublic()` which exposes only customer-safe fields and the **B2C price** (`b2cPrice ?? sellingPrice`) — never cost/B2B/supplier/HSN.
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

## Planned (not built yet) — see MEMORY `storefront-ecommerce-build`
Razorpay online payment (needs `RAZORPAY_KEY_ID/SECRET`; COD works now); order status management in the admin;
S3 media go-live. The `Order` model + constants exist and orders are live (COD).

## Conventions
Follow the same envelope as the rest of the API: lists `{ data, meta }`, single `{ data }`. Online orders must reduce inventory through `backend/src/services/stock.ts`, never ad-hoc. Never expose cost/B2B/supplier data on public routes.
