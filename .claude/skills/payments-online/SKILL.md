---
name: payments-online
description: Work on MNM Fashion online storefront payments via Razorpay — creating the gateway order, verifying the checkout signature, the webhook, and the storefront payment UI. Use for anything about Razorpay, online payment, UPI/card checkout on /shop, or payment webhooks. (In-store billing payments are the separate `customers`/billing flow.)
---

# Online payments (Razorpay)

Online payment for the customer storefront. **COD works without any of this**; online is offered only
when Razorpay is configured.

## Config (env, optional)
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (both ⇒ online enabled), `RAZORPAY_WEBHOOK_SECRET` (for the
webhook). Surfaced as `env.razorpay = { keyId, keySecret, webhookSecret, configured }` in `config/env.ts`.
Keys live ONLY in env (Render dashboard / local `.env`) — never commit them. Test keys are `rzp_test_…`,
live keys `rzp_live_…`; the code is identical for both.

## Service (`backend/src/services/razorpay.ts`) — no SDK, uses fetch + crypto
- `isRazorpayConfigured()`.
- `createRazorpayOrder(amountRupees, receipt)` → POSTs `api.razorpay.com/v1/orders` (Basic auth), amount
  converted to integer paise. Returns `{ id: order_xxx, ... }`.
- `verifyPaymentSignature(orderId, paymentId, signature)` — HMAC-SHA256 of `orderId|paymentId` with the
  secret, timing-safe compare. Cryptographic proof of success (not a browser flag).
- `verifyWebhookSignature(rawBody, signature)` — HMAC of the raw body with the webhook secret.

## Flow (`backend/src/services/orders.ts`)
1. `createOrder` with `paymentMethod:'online'` → reserves stock, creates a Razorpay order, stores
   `razorpayOrderId` on the Order (`paymentStatus:'pending'`). Rejects if Razorpay isn't configured.
2. `confirmOnlinePayment(orderId, customerId, { razorpayPaymentId, razorpaySignature })` — verifies the
   signature, sets `paymentStatus:'paid'` + `status:'confirmed'`. **Idempotent.**
3. `markOrderPaidByRazorpayOrderId(razorpayOrderId, paymentId)` — the webhook path (authoritative even if
   the browser closes). **Idempotent.**

## Endpoints (`backend/src/routes/store/`)
- `POST /api/store/orders` → returns `{ data: order, payment }`; `payment` is `{ provider, keyId,
  razorpayOrderId, amount(paise), currency }` for online, else `null`.
- `POST /api/store/orders/:id/verify` (`requireCustomer`) → confirms via signature.
- `POST /api/store/razorpay/webhook` (no auth; raw-body HMAC). Raw bytes captured by `express.json`'s
  `verify` hook in `app.ts` (`req.rawBody`). Handles `payment.captured` / `payment.authorized`.
- `GET /api/store/config` → `{ onlinePayment, razorpayKeyId, shopName, currency }` so the UI knows whether
  to show the online option.

## Frontend (`frontend/src/store/`)
`lib/storeApi.ts`: `loadRazorpay()` (injects checkout.js), `openRazorpay(options)`, `RazorpayPayment`
type. `pages/Checkout.tsx`: fetches `/config`, shows COD vs Online radios, on online opens Razorpay
Checkout then calls `/orders/:id/verify` in the handler; `modal.ondismiss` leaves the order pending.

## Dashboard setup (tell the user)
Webhook URL `https://<domain>/api/store/razorpay/webhook`, events `payment.captured` +
`payment.authorized`, set the signing secret as `RAZORPAY_WEBHOOK_SECRET`.

## Known gaps
An abandoned online order keeps stock reserved until an admin cancels it (no auto-expiry yet). Refunds via
Razorpay API are not wired (admin cancel only releases stock, doesn't refund money).
