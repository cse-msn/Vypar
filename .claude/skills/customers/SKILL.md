---
name: customers
description: Work on MNM Fashion customers, payments/receipts, ledgers, and online-store customer journey analytics. Use for the Customers/Payments pages, customer balances, or viewing a customer's store journey.
---

# Customers, payments & journey

## Where it lives
- **UI:** `frontend/src/pages/Customers.tsx` (list + add/edit dialog, plain `useState`), `frontend/src/pages/Payments.tsx`.
- **Backend:** `backend/src/routes/customers.routes.ts` (CRUD + `GET /:id/ledger` + `GET /:id/journey`),
  `backend/src/routes/payments.routes.ts`, `backend/src/services/payments.ts`.
- **Model:** `backend/src/models/Customer.ts` — one unified customer base for both the shop and the online store.
  It carries a `balance` (receivable) and an optional `passwordHash` (set when a customer self-registers online).

## Balances & payments
- A credit sale raises the customer `balance`; cancelling an invoice reverses it.
- `recordPayment` (services/payments.ts) logs a receipt and **auto-allocates to the oldest open invoices**. Money via
  `utils/money.ts`. Ledger = recent invoices + payments + current balance.

## Online-store journey analytics
- `StoreEvent` model + `POST /api/store/events` ingest (see the `store-api` skill). Anonymous events stitch to the
  customer on signup/login.
- Owner view: `GET /api/customers/:id/journey` → the customer's event timeline (product populated), counts by type,
  and an `abandonedCart` flag (added to cart, never purchased). Good for follow-ups.

## Conventions
- Follow the Suppliers/Settings dialog pattern (manual `useState`) for customer forms.
- Never expose `passwordHash` (stripped by `applyToJSON`). First-party analytics only.
