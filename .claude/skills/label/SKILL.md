---
name: label
description: Print or change product barcode tags / labels for MNM Fashion (50x25 mm thermal, A4 sheet, or bulk). Use when asked about barcodes, tags, labels, label size, what prints on a tag, or the tag price.
---

# Barcode labels / tags

Each product variant has a globally-unique code — `variant.sku` = `<product.code><seq padded to 3>` (e.g. `200007001`) — rendered as a **Code-128** barcode. There is no separate `barcode` field.

## Where it's built
- **Generator:** `backend/src/services/labelPdf.ts` (pdfkit + bwip-js). Two layouts: `sheet` (A4, 12-up) and `roll` (one label per page at `w×h` mm, **default 50×25**).
- **Item builder:** `buildLabelItems(product, variants, copies)` in `backend/src/routes/products.routes.ts` — the single place that decides what each tag shows. Both routes below use it.
- **Tag price format:** `<prefix>-<B2B>-<B2C>` (e.g. `10082327-450-855`), built in `buildLabelItems`. The prefix is `env.priceCode.tagPrefix` (`PRICE_CODE_TAG_PREFIX`, default `10082327`). Legacy products without B2B/B2C fall back to the selling price. (The old `encodePrice` obfuscation in `utils/priceCode.ts` is no longer used on tags.)
- **Size group on the tag** shows only the range ends (`20-24-28-32-36` → `20-36`) via `sizeRangeEnds`, from `product.sizeGroup` or the derived run.

## Endpoints (staff auth)
- `GET /api/products/:id/labels?variantId=&copies=&format=sheet|roll&w=&h=&download=` — one product (all variants or one).
- `GET /api/products/labels?search=&copies=&format=&download=` — **bulk**: every active product, optionally filtered by `search` (capped at 5000 labels).

## Frontend
- Per-product: `frontend/src/components/LabelDialog.tsx` (opened from the Products page per card). Defaults to the 50×25 roll.
- Bulk: `frontend/src/components/BulkLabelDialog.tsx` (Products page header "Print labels"). Prints the current search filter or all.
- Both fetch the authenticated PDF via `openPdf` (`frontend/src/lib/pdf.ts`).

## Changing what a tag shows
Edit **`buildLabelItems`** (fields fed in) and/or `labelPdf.ts` (layout). The `LabelItem` shape is `designNumber, shopName, itemCode(sku), color, designName, size, sizeGroup, priceCode` (priceCode = the `<prefix>-<B2B>-<B2C>` string). Verify by fetching the PDF and checking `%PDF`, page count (= variants × copies), and MediaBox (50 mm = 141.7 pt, 25 mm = 70.9 pt).
