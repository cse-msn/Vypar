---
name: import-shopify
description: Migrate a Shopify store's catalog (products, variants, prices, photos AND videos) into MNM Fashion. Use when asked to import/migrate/pull products or media from Shopify, or to run/troubleshoot the Shopify importer.
---

# Shopify → MNM Fashion importer

One script, driven entirely by env/credentials: `backend/src/scripts/importShopify.ts`
(run with `npm run import:shopify -w backend`). It pulls every product from Shopify via the **Admin
GraphQL API**, downloads each media file (images **and** videos), re-uploads them to this app's object
storage (`services/storage` → R2/local), and creates `Product` docs. **Idempotent** — a product already
imported (matched by design number `SH-<legacyResourceId>`) is skipped, so re-runs are safe.

## Credentials the user must provide (nothing else)
- `SHOPIFY_STORE` = `your-store.myshopify.com`
- `SHOPIFY_ADMIN_TOKEN` = a **custom-app Admin API access token** with `read_products` (Shopify admin →
  Settings → Apps and sales channels → Develop apps → create app → Admin API scopes `read_products` →
  Install → reveal `shpat_…` token). **Never ask for the Shopify account password / login.**
- `SHOPIFY_API_VERSION` optional (default `2024-10`).
- Plus the normal app env pointing at the **target** store: `MONGODB_URI` (Atlas for live),
  `STORAGE_DRIVER=s3` + `S3_*` (R2, so media lands in the bucket), and `JWT_SECRET` (any value — env
  validation requires it even for a script run).

## Flags
- `--dry-run` — fetch + map + log, write nothing (good first pass).
- `--limit N` — only the first N products (a safe trial before the full run).

## Field mapping (Shopify → Product)
title→name · descriptionHtml→description (HTML stripped) · vendor→brand · productType→productType ·
tags→tags · status→status (active/draft/archived) · handle→handle · media images→`images[]`, videos→
`videos[]` (stored as `/api/media/<uuid>.<ext>`) · variant price→`b2cPrice` (min across variants) +
per-variant `sellingPrice`; compareAtPrice→`compareAtPrice` · variant options→colour+size (see below) ·
inventoryQuantity→variant `quantity` · Shopify SKUs preserved in a `customFields` entry. Our own barcode
SKU is auto-generated as usual.

## Colour/size resolution (`colourAndSize` + `isColorValue`/`isSizeValue`)
Shopify option data is messy — colour-only products, size-only products, flipped option order, a stray
"Target gender" option, and compound colours ("Navy Blue", "Yellow Black"). The resolver: (1) prefers the
explicitly-named `Color`/`Size` options from `product.options`; (2) falls back to **value shape** — a value
is a colour if any token is in `COLOR_WORDS` (so compounds match), a size if numeric / in `SIZE_WORDS` —
and never borrows an unrelated option. Missing colour → `Default`; missing size → `Free`. Colours are
title-cased and each distinct one is upserted into the **Color** collection (managed-list dropdown).

## Gotchas
- Media MIME is taken from the download's content-type, falling back to the URL extension; only the mimes
  in `utils/mime.ts` are accepted.
- Shopify catalog is the merchant's own business data pulled via their API into their own DB — an approved
  workflow (no PII sent to an external service).
- Shopify GraphQL has cost-based rate limits; the script paginates 25/page with a short delay. If throttled,
  lower the page size or add backoff.
- Design numbers are `SH-<id>` so imported products don't collide with the shop's own numbering.
