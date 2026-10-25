# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Fuller context:** `docs/SUPER_PROMPT.md` is the master project brief (full feature inventory, online-store
> roadmap + current status, decisions, prerequisites). This file is the concise operating guide; keep both current.
> A draft storefront AI-assistant system prompt lives in `docs/ai-assistant-prompt.md`.

## What this is

MNM Fashion — a unified inventory, stock, purchasing, billing and reporting platform for a clothing shop. One React + TypeScript frontend runs as a responsive website **and** an installable PWA; a Node + Express + MongoDB backend is the **single source of truth**. A customer-facing online store (catalog + accounts + journey analytics, with checkout/payments planned) is being added under the backend's `/api/store` namespace.

npm **workspaces** monorepo: `backend/` (REST API) and `frontend/` (React PWA).

## Commands

Run from the repo root unless noted. `-w backend` / `-w frontend` target a workspace.

```bash
npm install                      # installs both workspaces

npm run dev                      # run API (:4000) + web (:5173) together (concurrently)
npm run dev:api                  # backend only  (tsx watch)
npm run dev:web                  # frontend only (vite)

npm run build                    # backend tsc + frontend tsc --noEmit && vite build
npm run typecheck -w backend     # tsc --noEmit (backend)
npm run typecheck -w frontend    # tsc --noEmit (frontend)  ← preferred quick check

npm run test -w backend          # vitest (backend) — uses mongodb-memory-server, no live DB needed
npm run test -w frontend         # vitest (frontend)
npm run test:api -w backend      # scripted API smoke test (src/scripts/apiTest.ts)

npm run seed                     # seed dev data (idempotent: users always; sample data only if catalogue empty)
npm run seed -w backend -- --fresh   # wipe all collections first, then seed
npm run seed:more -w backend     # add extra dummy data
```

Run a single backend test: `cd backend && npx vitest run src/path/to/file.test.ts` or `npx vitest run -t "test name"` (add `--watch` for watch mode).

**No linter is configured** — the root `lint` script is a `--if-present` no-op. Use `typecheck` as the gate. Both `typecheck` and `build` use `frontend/tsconfig.build.json`, which excludes `*.test.*` files (tests are checked at runtime by Vitest), so the gate is clean.

**Prerequisites:** MongoDB must be reachable at `backend/.env`'s `MONGODB_URI` (default `mongodb://127.0.0.1:27017`). The backend validates its entire env with zod on boot (`src/config/env.ts`) and **refuses to start** if anything required is missing/invalid — so configuration fails fast, not at request time.

## Architecture (the parts that span files)

### Backend request pipeline
`src/index.ts` → `createApp()` (`src/app.ts`: helmet, CORS restricted to `env.corsOrigins`, rate limit) → mounts the aggregated router from `src/routes/index.ts` at **`/api`** → per-entity routers (`*.routes.ts`).

Conventions every route follows:
- `router.use(requireAuth)` at the top guards staff/owner routes; `requireRole('owner')` gates owner-only actions. **Exception:** `src/routes/store/*` (the online store) does NOT use staff auth.
- Request bodies/queries are validated+coerced by `validateBody` / `validateQuery` (`src/middleware/validate.ts`) against zod schemas; failures become `ApiError.badRequest`.
- Handlers are wrapped in `asyncHandler`; they throw `ApiError` (`src/utils/ApiError.ts` — `.notFound()`, `.badRequest()`, `.conflict()`, `.unauthorized()`, `.forbidden()`), caught by `src/middleware/error.ts`.
- **Response envelope:** list endpoints return `{ data, meta }` (`meta` from `buildMeta`, `src/utils/pagination.ts`); single/create/update return `{ data }`. Pagination `limit` is capped at **200** — larger requests 400.

### Two separate identities (don't mix tokens)
- **Staff/owner:** `User` model, JWT via `src/services/auth.ts`, `requireAuth`/`requireRole`, read as `req.user`.
- **Storefront customers:** `Customer` model gains a `passwordHash`; JWT via `src/services/storeAuth.ts` carries `typ: 'customer'`; guarded by `requireCustomer` (or `optionalCustomer` for public+anonymous routes), read as `req.customer`. Both signed with the same `JWT_SECRET`, distinguished by claims — a staff token is rejected on store routes and vice-versa.

### Data-model keystones (`backend/src/models`)
- **Product → variant SKUs are the barcodes.** A product gets a global `code` (counter, 200001+) and a monotonic `variantSeq`; a `pre('validate')` hook assigns each variant a `seq` and `sku = \`${code}${seq padded to 3}\`` (e.g. `200007001`). A **unique sparse index on `variants.sku`** guarantees global uniqueness. Scanners resolve a scanned string via `GET /api/products/lookup?barcode=`. There is no separate `barcode` field — the `sku` *is* the payload.
- **All stock changes go through `src/services/stock.ts`:** `reserveStock` (atomic conditional decrements with **compensation/rollback — no DB transactions**, so it's all-or-nothing under concurrency without needing a replica set), `releaseStock`, `addStock`, `removeStockSafe`. Sales (`services/sales.ts`) reserve; purchases (`services/purchases.ts`) add; cancels/edits reverse by the net delta.
- **Historical documents snapshot their lines** (designNumber, sku, color, size, price) so invoices/purchases/orders stay stable even if the product later changes.
- **Human-readable numbers** (INV-, PUR-, ORD-) come from `models/Counter.ts` (`nextSequence` + `formatNumber`).
- **`applyToJSON` (`utils/toJSON.ts`)** standardizes every model's serialization: adds `id`, strips `__v`, and drops sensitive fields (e.g. `passwordHash`). Money math is centralized in `utils/money.ts` (`round2`, `clamp`).

### Labels / barcodes
`services/labelPdf.ts` (pdfkit + bwip-js, Code-128) renders either an **A4 sheet (12-up)** or a **50×25 mm thermal roll (one label/page)**. The tag price prints as `<prefix>-<B2B>-<B2C>` (e.g. `10082327-450-855`; prefix = `env.priceCode.tagPrefix` / `PRICE_CODE_TAG_PREFIX`). Label items are built by the shared `buildLabelItems` helper in `products.routes.ts`, used by both `GET /api/products/:id/labels` (one product) and `GET /api/products/labels` (bulk/filtered).

### Online store (`backend/src/routes/store/`, under `/api/store`)
Public catalog (`products.routes.ts` — exposes only customer-safe fields and the **B2C price**, never cost/B2B/supplier), customer accounts (`auth.routes.ts` — register/login/me, stitches anonymous journey on signup), and journey analytics (`StoreEvent` model + `events.routes.ts` ingest; owner views a customer's journey via `GET /api/customers/:id/journey`). First-party only — nothing is sent to third-party analytics.

### Frontend
- **`App.tsx`** lazy-loads pages; `ProtectedRoute` + `Layout` wrap authed routes; `/login` and `/bill/:token` are public.
- **Server state = TanStack Query.** Query keys are centralized in `src/lib/queryKeys.ts` and **entity-prefixed**, so `invalidateQueries({ queryKey: ['products'] })` refreshes every product list/detail (this is how a change on one device propagates). The query cache is **persisted to localStorage and cleared on logout**.
- **API via `src/lib/api.ts`** (axios + bearer token; `getApiError` normalizes errors). Per-entity hooks live in `src/hooks/*`. Convention mirrors the backend envelope: **list hooks read the response's `.data`** (the `{data,meta}` → `Paginated<T>`), while **single/create/update read `.data.data`**.
- **Forms:** the complex `ProductForm` uses react-hook-form + zod; simpler dialogs (Suppliers, Settings) use plain `useState` + manual validation. Match the surrounding file.
- **UI:** shadcn-style primitives in `src/components/ui/*`; shared `PageHeader`/`EmptyState`/`Pagination`; toasts via `sonner`; icons from `lucide-react`.
- **PWA** via vite-plugin-pwa (controlled "update available" prompt; service worker **off in dev**). Camera barcode scanning (`@zxing`) needs a secure context — plain `localhost` is fine, but phones on the LAN need HTTPS: run `VITE_HTTPS=true npm run dev:web`.
- **Protected PDFs** are fetched as blobs with the bearer token via `src/lib/pdf.ts` (`openPdf`) — you can't just navigate the browser to an authenticated PDF URL.

## Conventions to preserve
- Keep the `{ data }` / `{ data, meta }` envelope and the list-vs-single `.data` / `.data.data` read split consistent when adding endpoints/hooks.
- New stock-affecting operations must go through `services/stock.ts`, not ad-hoc `$inc`.
- New per-entity list endpoints should reuse `paginationSchema` + `paginate` + `buildMeta`.
- Tag price format is `<prefix>-<B2B>-<B2C>` (`buildLabelItems`); the catalog/customer price is `b2cPrice` (falling back to `sellingPrice`).
- **Keep skills current.** There is a `.claude/skills/` skill per feature area (dev, seed, check, deploy, label, billing, purchases, customers, invoices, reports, store-api, discounts, add-product-field, add-endpoint). When you add or materially change a feature, add or update its skill in the same change — and add a new skill when you introduce a new feature area.
