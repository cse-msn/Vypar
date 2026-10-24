# MNM Fashion — Super Prompt (Master Project Brief)

> **Purpose.** A single, self-contained brief that fully onboards any AI assistant or developer to this
> project: what it is, how it's built, everything that exists, what's planned, and the conventions to
> follow. Paste it as context, or read it top-to-bottom before working.
>
> **Keep this current.** Update the "Current status" and "Feature inventory" sections whenever a feature
> lands. For day-to-day operating rules, see `CLAUDE.md` (auto-loaded by Claude Code). This document is
> the fuller narrative; `CLAUDE.md` is the concise operating guide.
>
> _Last updated: 2026-10-20._

---

## 1. What this is

**MNM Fashion** (repo also referred to as "Vypar") is a unified **inventory, stock, purchasing, billing and
reporting platform** for a clothing retail shop in Pune, India. One React + TypeScript frontend runs both as
a **responsive website** and an **installable PWA** (no separate native app). A Node + Express + MongoDB
backend is the **single source of truth** — a sale on a phone updates the desktop after the next refresh.

A **customer-facing online store** (Shopify-style, on the same stack) is being added: public catalog,
customer accounts, cart/checkout, payments, and customer-journey analytics — all reading the same MongoDB
and reducing the same inventory.

**Users / roles:** `owner` (full access incl. user management, size groups, deletes), `staff` (daily ops).
Online shoppers are a separate identity (`Customer` accounts), never staff.

## 2. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind, shadcn-style UI, React Router, TanStack Query, React Hook Form + Zod, vite-plugin-pwa, @zxing (camera scan) |
| Backend | Node + Express + TypeScript, Mongoose |
| Database | MongoDB (single source of truth) |
| Storage | S3-compatible (prod) / local filesystem (dev) for images, videos, invoice PDFs |
| PDF / barcodes | pdfkit + bwip-js (Code-128) |
| Payments (planned) | Razorpay (India) + Cash on Delivery |
| Tests | Vitest + Supertest + mongodb-memory-server (backend); Vitest + Testing Library (frontend) |

Monorepo via **npm workspaces**: `backend/`, `frontend/`. (A `storefront/` app is planned.)

## 3. Architecture (big picture)

- **Request pipeline:** `backend/src/index.ts` → `createApp()` (`app.ts`: helmet, CORS by `env.corsOrigins`,
  rate limit) → aggregated router (`routes/index.ts`) mounted at **`/api`** → per-entity routers.
- **Envelope convention:** list endpoints return `{ data, meta }`; single/create/update return `{ data }`.
  Frontend list hooks read `.data`; single/create/update read `.data.data`. Pagination `limit` is capped at **200**.
- **Two identities:** staff/owner (`User` + `requireAuth`/`requireRole`, `req.user`) and storefront customers
  (`Customer` + `passwordHash`, token `typ:'customer'`, `requireCustomer`/`optionalCustomer`, `req.customer`).
  Same `JWT_SECRET`, distinguished by claims; tokens are not interchangeable.
- **Validation & errors:** zod via `validateBody`/`validateQuery`; handlers throw `ApiError.*`, caught centrally.
- **Stock is sacred:** every stock change goes through `services/stock.ts` — `reserveStock` (atomic conditional
  decrements with compensation/rollback; **no DB transactions**, all-or-nothing under concurrency),
  `releaseStock`, `addStock`, `removeStockSafe`. Sales reserve, purchases add, cancels/edits reverse by net delta.
- **Barcodes:** a product has a global `code` (200001+) and `variantSeq`; a `pre('validate')` hook gives each
  variant `sku = <code><seq padded 3>` (e.g. `200007001`) — the globally-unique barcode (unique sparse index).
  Scanned codes resolve via `GET /api/products/lookup`.
- **Serialization:** `applyToJSON` adds `id`, strips `__v`, drops secrets (`passwordHash`). Money via `utils/money.ts`.
- **Frontend state:** TanStack Query; entity-prefixed keys in `lib/queryKeys.ts` (invalidate `['products']`
  refreshes all product queries); cache persisted to localStorage, cleared on logout. API via `lib/api.ts` (axios + bearer).

## 4. Feature inventory (what exists today)

**Catalog & stock**
- Products with **design → colour → size** variants, each with its own SKU/barcode, quantity, low-stock threshold.
- Prices: cost (purchase), selling, **B2B**, **B2C** (B2B/B2C required on new products).
- Classification: **category** + **sub-category** (apparel), **named size group** (managed in Settings).
- Apparel attributes (shown only for apparel categories): dupatta (Y/N), dupatta height, back opening
  (Open/Closed/Backless), blouse size (from the size groups), gher, cap, belt, sleeves (Full/Half/Sleeveless),
  back knot/hook, pant/dhoti. Plus tax rate, HSN, unit, images/videos, custom fields.
- **Size groups** and **Colours**: owner-managed CRUD in Settings. Size groups drive the variant grid and
  blouse-size dropdown; colours drive the variant colour dropdown (grid + row editors).
- **Barcodes/labels**: Code-128, **50×25 mm thermal** (one/label) + A4 (12-up) + **bulk** (all/filtered);
  tag shows design no., "MNM Fashion, Pune", colour, size, size-range ends (`20-36`), and the price as
  `<prefix>-<B2B>-<B2C>` (e.g. `10082327-450-855`). On the product form, B2C auto-fills to **1.9× B2B** (editable).
- Stock lookup by barcode (camera/scanner) or design/colour/size; inline adjust.

**Transactions**
- **Billing**: scan-to-add (hardware scanner input + camera), pick/create customer, discounts/tax/round-off/
  part-payment; saving reduces stock. Public tokenized bill link `/bill/:token`; WhatsApp share; server-side PDF.
- **Purchases**: stock-in + supplier payable; cancel reverses safely; **edit a saved purchase** reconciles stock
  by net delta and moves the supplier balance (incl. supplier change).
- **Customers & payments**: ledgers, outstanding dues, receipts auto-allocated to oldest invoices.
- **Reports**: dashboard, sales (chart + top products), inventory valuation / low stock, financial (receivables/payables).
- PWA (installable, offline shell, controlled update prompt). Owner-managed users in Settings.

**Online store (new — backend foundation only)**
- Public catalog `/api/store/products` (B2C price only; cost/B2B/supplier never exposed) + categories.
- Customer accounts `/api/store/auth` (register/login/me); self-registration attaches to an existing shop customer by email.
- **Journey analytics**: `StoreEvent` log (page_view, view_product, search, add/remove_to_cart, begin_checkout,
  purchase, signup, login) via `POST /api/store/events`; anonymous events **stitch** to the customer on signup/login;
  owner views a customer's journey + abandoned-cart flag via `GET /api/customers/:id/journey`.
- `Order` model + order constants exist, ready for checkout.

## 5. Online store roadmap & current status

| Phase | Scope | Status |
|---|---|---|
| 1 | Backend foundation: Order model, customer accounts, public catalog API | **Done & verified** |
| 1b | Customer journey analytics (events + stitching + owner view) | **Done & verified** |
| 2 | Checkout + Orders (COD): place order, reserve stock, "my orders" | TODO |
| 3 | Razorpay online payments (create-order + signature verify) | TODO — needs keys |
| 4 | Separate `storefront/` React app (home, browse, product, cart, checkout, login, account) | TODO |
| 5 | Go-live: S3 media, CORS, order confirmation (email/WhatsApp), hosting/domain/HTTPS | TODO |

**Decisions locked:** own store on this stack (not real Shopify); separate storefront app; COD **and** Razorpay;
full feature set; MongoDB + S3 as the single source of truth.

**Needed from the owner to go fully live:**
- **Razorpay** test key id + secret (payments can be coded/stubbed without them).
- **S3** bucket + credentials (set `STORAGE_DRIVER=s3`; backend already supports it).
- A **domain + hosting** decision (the app runs locally today).

## 6. Commands

```bash
npm install                               # both workspaces
npm run dev                               # API :4000 + web :5173 (concurrently)
npm run typecheck -w backend | -w frontend
npm run test -w backend | -w frontend     # vitest (backend uses mongodb-memory-server)
npm run seed                              # dev data (idempotent); add -w backend -- --fresh to wipe first
VITE_HTTPS=true npm run dev:web           # HTTPS for phone camera scanning on the LAN
```
Seed logins: owner `owner@mnm.fashion`/`owner123`, staff `staff@mnm.fashion`/`staff123`. **MongoDB must be running**
(`MONGODB_URI`); the backend validates env on boot and won't start otherwise. **No linter** — use typecheck.
`typecheck`/`build` use `frontend/tsconfig.build.json` (excludes `*.test.*`), so the gate is clean.

## 7. Conventions to preserve

- Keep the `{ data }` / `{ data, meta }` envelope and the list-vs-single `.data` / `.data.data` read split.
- New stock-affecting logic goes through `services/stock.ts`, never ad-hoc `$inc`.
- New list endpoints reuse `paginationSchema` + `paginate` + `buildMeta`.
- Tag price format is `<prefix>-<B2B>-<B2C>` (`buildLabelItems`); the customer/catalog price is `b2cPrice` (fallback `sellingPrice`).
- Public store routes never expose cost/B2B/supplier/HSN.
- Adding a product field means wiring model → validation → type → form schema/defaults/reset/submit → UI
  (see the `add-product-field` skill). Adding an entity: see the `add-endpoint` skill.
- Journey/analytics data is **first-party only** — never send customer PII to third-party services.

## 8. Project skills (`.claude/skills/`)

`dev`, `seed`, `check`, `label`, `store-api`, `add-product-field`, `add-endpoint`. Invoke by name when the task matches.

## 9. Housekeeping / known items

- `frontend/mnm.txt` is a stray 387 KB chat transcript from an earlier session — safe to delete or move to `docs/`.
- MongoDB in dev is a **portable install**, not a Windows service (started via a per-user logon scheduled task).
- Env is validated by `backend/src/config/env.ts`; see `backend/.env.example` for all variables.
