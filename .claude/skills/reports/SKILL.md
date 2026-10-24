---
name: reports
description: Work on MNM Fashion reports & dashboard — sales (chart + top products), inventory valuation / low stock, and financial (receivables/payables). Use for the Dashboard/Reports pages or report aggregation endpoints.
---

# Reports & dashboard

## Where it lives
- **UI:** `frontend/src/pages/Dashboard.tsx` and `frontend/src/pages/Reports.tsx` (charts via **recharts**, code-split
  into a `charts` chunk). Query keys: `qk.dashboard`, `qk.reportSales(params)`, `qk.reportInventory`,
  `qk.reportFinancial(params)` in `frontend/src/lib/queryKeys.ts`.
- **Backend:** `backend/src/routes/reports.routes.ts` — the aggregation endpoints (dashboard summary, sales over a
  date range + top products, inventory valuation / low-stock, financial receivables/payables).

## Conventions
- These are **read-only aggregations** (MongoDB aggregation pipelines over invoices/products/payments/purchases).
  Keep them read-only; don't mutate data from a report route.
- Respect money helpers (`utils/money.ts`) for any computed totals so rounding matches the rest of the app.
- Reports reflect the current DB state; since invoices/purchases snapshot their lines, historical figures stay stable.
- When adding a metric, prefer a single aggregation pipeline over N queries; reuse date-range query parsing already in
  the route. Return the usual `{ data }` envelope.
