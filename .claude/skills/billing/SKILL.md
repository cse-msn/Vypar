---
name: billing
description: Work on MNM Fashion billing / sales invoices — creating a bill, scan-to-add, discounts/tax/round-off/part-payment, and how a sale reduces stock. Use for changes to the Billing page, invoice creation, or the sell flow.
---

# Billing / sales

## Where it lives
- **UI:** `frontend/src/pages/Billing.tsx`. A bill line is `{ key, product, variant, quantity, price }`; all lines
  funnel through `addLine(product, variant)` (dedups by `variant._id`, caps qty at stock, defaults tax% from `product.taxRate`).
- **Create-invoice hook:** `frontend/src/hooks/invoices.ts` → `useCreateInvoice()` (`POST /api/invoices`, sends an
  `Idempotency-Key` header). Line items reference product+variant **by `_id`** (not sku): `{ productId, variantId, quantity, price?, discount? }`.
- **Backend:** `backend/src/services/sales.ts` → `createInvoice(input, user)`. Price defaults to
  `variant.sellingPrice ?? product.sellingPrice`. Server computes subtotal/discount/tax/round-off/total — never trust client totals.

## Three ways items are added (all → `addLine`)
1. **Scan-to-add** — the "Scan tag" text input (hardware scanner, autofocus, refocuses after each scan) + a camera
   button (`BarcodeScanner`, `@zxing`). Both call `handleScanCode(code)` → `lookupProduct({ barcode: code })`
   (`GET /api/products/lookup`) → add the resolved variant; if only a design matches, it opens `ProductPicker`.
2. **ProductPicker** ("Add product") — search by design/name/brand/sku.
3. Manual qty/price edits per line.

## Stock & money
- Selling **reserves stock atomically** via `reserveStock` (`services/stock.ts`) before persisting; on any failure it
  rolls back (`releaseStock`). Overselling is impossible. `cancelInvoice` releases stock back.
- The invoice **snapshots** each line (designNumber, sku, color, size, price) so it stays stable if the product changes.
- Money via `utils/money.ts` (`round2`, `clamp`). Human number `INV-…` from `Counter`.

## Conventions
- Keep totals server-computed. Reference variants by id in payloads. Blocks when offline or over-stock.
- Retail price today is `sellingPrice`; B2B/B2C are separate product fields (see `add-product-field`). If billing
  should use B2C, change the price default in `sales.ts` + `Billing.addLine` together.
