# MNM Fashion — Inventory & Billing (Web + PWA)

A unified inventory, stock, purchasing, billing and reporting platform for **MNM Fashion**.
One React + TypeScript codebase runs as a **responsive website on desktop** and as an
**installable Progressive Web App (PWA)** on Android/iOS/desktop — both talking to the **same
Node + MongoDB backend**, so stock and finances stay in sync across every device.

> There is **no separate Android app**. The installable PWA replaces it.

---

## ✨ Features

- **Auth & roles** — JWT login; `owner` (full access incl. user management) and `staff`.
- **Products & variants** — track stock by **design number → colour → size**, each variant with its own SKU/barcode, quantity, price and low-stock threshold.
- **Stock lookup** — by barcode (camera scan) or by design/colour/size; adjust stock inline.
- **Fast billing** — add items (search or scan), pick/create a customer, discounts, tax, round-off, part-payment, and save. Server computes all totals.
- **Purchases & suppliers** — record stock received from suppliers (stock-in + payable tracking); cancel reverses stock safely.
- **Customers & payments** — customer ledger, outstanding dues, record receipts (auto-allocated to oldest invoices).
- **PDF invoices** — generated server-side, stored in private object storage.
- **Customer PDF links** — secure, tokenised `/bill/<token>` page customers open without logging in.
- **WhatsApp sharing** — one tap opens WhatsApp (app/web) with a prefilled message containing the real invoice link.
- **Reports** — dashboard, sales (with chart + top products), inventory valuation / low stock, financial (receivables/payables).
- **PWA** — installable, offline app shell, safe update prompts, responsive mobile + desktop layouts.

---

## 🏗 Architecture

```
 Desktop browser  +  Installed mobile PWA
                   │   (same React + TypeScript build)
                   ▼
        Backend REST API  (Node + Express + TypeScript)
                   │
                   ├──────────────► MongoDB  (source of truth: stock, invoices, payments)
                   └──────────────► Object storage (S3-compatible / local) for invoice PDFs
```

The **backend is the single source of truth**. The website and the PWA share the same frontend
code, the same API, and the same database — a sale on a phone updates the desktop after the next
refresh/refetch.

### Tech stack
| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript, **Vite**, Tailwind CSS, shadcn-style UI, React Router, **TanStack Query**, React Hook Form + Zod, **vite-plugin-pwa** |
| Backend | Node + **Express** + TypeScript, Mongoose |
| Database | **MongoDB** |
| Storage | Amazon S3 / any S3-compatible (MinIO, R2, Spaces); **local filesystem** fallback for dev |
| PDF | pdfkit (server-side) |
| Tests | Vitest + Supertest + mongodb-memory-server (backend); Vitest + Testing Library (frontend) |

---

## 📁 Project structure

```
Mnm_stock/
├── backend/           # REST API, MongoDB models, PDF + storage services
│   ├── src/
│   │   ├── config/        env + db connection
│   │   ├── models/        User, Product(+variants), Customer, Supplier, Invoice, Payment, Purchase, Counter
│   │   ├── services/      stock, sales, purchases, payments, pdf, storage, whatsapp, auth
│   │   ├── routes/        auth, products, customers, suppliers, purchases, invoices, payments, reports, public
│   │   ├── middleware/    auth, validate, error
│   │   ├── scripts/seed.ts
│   │   └── tests/         integration tests
│   └── .env.example
├── frontend/          # React PWA (website + installable app)
│   ├── src/
│   │   ├── components/    UI kit, Layout, pickers, dialogs, PWA prompts
│   │   ├── pages/         Login, Dashboard, Billing, Products, StockLookup, Invoices, Customers, …, PublicBill
│   │   ├── hooks/         typed TanStack Query hooks per domain
│   │   └── lib/           api client, query client (+persistence), pdf, format
│   ├── scripts/generate-icons.mjs   # regenerate PWA icons
│   └── .env.example
└── package.json       # npm workspaces + combined dev script
```

---

## 🚀 Getting started

### Prerequisites
- **Node.js ≥ 20** (tested on 24)
- **MongoDB** running locally (`mongodb://127.0.0.1:27017`) or a connection string (e.g. MongoDB Atlas)

### 1. Install
```bash
npm install            # installs both workspaces
```

### 2. Configure environment
```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
```
Edit `backend/.env` — set `MONGODB_URI` and a strong `JWT_SECRET` (`openssl rand -hex 48`).
For dev, `STORAGE_DRIVER=local` works with no cloud credentials.

### 3. Seed sample data (optional but recommended)
```bash
npm run seed           # creates owner + sample products/customers/suppliers
# or wipe & reseed:  npm run seed -- --fresh
```
Default owner login: **owner@mnm.fashion** / **owner123** → _change it after first login_.

> No seed? The **Login screen** has a “Set up the owner account” option that bootstraps the first owner.

### 4. Run (website + API together)
```bash
npm run dev            # API on :4000, web on :5173 (Vite proxies /api → :4000)
```
Open http://localhost:5173.

### Useful scripts
| Command | What |
|---|---|
| `npm run dev` | Run backend + frontend together |
| `npm run dev:api` / `npm run dev:web` | Run one side |
| `npm run build` | Build backend (tsc) + frontend (Vite + PWA) |
| `npm test` | Backend integration tests |
| `npm test -w frontend` | Frontend tests |
| `npm run seed [-- --fresh]` | Seed / reseed the database |
| `node frontend/scripts/generate-icons.mjs` | Regenerate PWA icons |

---

## 📱 PWA — install, offline & updates

- **Install**: Android/desktop Chrome/Edge show an in-app “Install” prompt; iOS Safari → *Share → Add to Home Screen* (guidance shown in-app). Requires **HTTPS in production** (localhost is exempt).
- **Offline**: the app **shell** and static assets work offline; previously-loaded data may show from the cached query store (cleared on logout). A clear **offline banner** appears.
- **Billing is online-only — by design.** See below.
- **Updates**: a new version shows a non-intrusive **“Update available → Reload”** banner, so an update never interrupts an in-progress bill.

### Why billing/stock changes are online-only
Inventory accuracy is the top priority. A reliable offline sales queue (persistent queue, idempotent
sync, server-side stock validation, conflict resolution, duplicate protection, recovery) is a large,
risky subsystem. Rather than fake it, **inventory-changing operations require a connection** and the UI
blocks them while offline with a clear message. Reads still work offline from cache. The backend already
supports the safe primitives for a future offline queue — **idempotency keys** (duplicate-safe retries)
and **atomic server-side stock validation**.

---

## 💬 WhatsApp sharing
After saving an invoice: the PDF is generated + stored, a secure public link is created, and a
**prefilled WhatsApp message** (invoice no, total, **real link**) opens via the official
`https://wa.me/<number>?text=…` click-to-chat URL — WhatsApp app on mobile, WhatsApp Web on desktop.
If no number is on file, WhatsApp opens the contact picker; “Copy link”, native **Share**, and
**View/Download PDF** are also offered. **You must press *send* in WhatsApp** — opening it does not send.

## 🔗 Customer PDF links & security
- Customers open `https://<domain>/bill/<token>` — **no login**. The token is a 192-bit random value; internal IDs and storage paths are never exposed, and one token only ever resolves its own invoice. Links can be revoked/rotated.
- The **storage bucket stays private**: PDFs are streamed through the API, never served from a public bucket.
- Service worker **never caches** invoice PDFs or authenticated/financial API responses; the TanStack Query cache is **cleared on logout**.
- Also: `helmet`, CORS allow-list, rate limiting (global + stricter on login + public routes), bcrypt password hashing, Zod validation on every write, Mongo injection avoided via typed queries.

---

## ✅ Testing

```bash
npm test               # backend: auth, stock deduction, insufficient-stock, idempotency,
                       #          cancel/restock, public token access, payments, reports
npm test -w frontend   # frontend: format utils + UI component render

# Full API acceptance run against a RUNNING server — hits every endpoint, prints a
# PASS/FAIL table, and writes backend/api-test-report.pdf (same format as the shop reports):
npm run dev:api        # (terminal 1) start the API
npm run test:api -w backend   # (terminal 2) → 56 checks across every route
```
Backend tests use an in-memory MongoDB, so no running database is needed for them.
The full endpoint checklist and how to run it live are in **[`docs/API_TEST_PLAN.md`](docs/API_TEST_PLAN.md)**.

What’s verified end-to-end: a sale **deducts stock atomically**, overselling is **rejected (409)**,
a retried submit with the same **idempotency key** creates **one** invoice (stock deducted once),
cancelling **restocks**, and a **customer PDF link works without authentication**.

See **[`docs/TESTING.md`](docs/TESTING.md)** for the full cross-device / cross-browser manual checklist.

---

## 🚢 Deployment, HTTPS & backups
- **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** — production build, HTTPS, env, single-service vs split hosting, S3 setup.
- **[`docs/BACKUP.md`](docs/BACKUP.md)** — MongoDB backup/restore and object-storage backup/recovery.

The backend can optionally **serve the built frontend** itself (it does automatically if
`frontend/dist` exists) for a simple single-process deployment.

---

## 🔐 A note on `npm audit`
Remaining advisories are **exclusively in dev/build tooling** (vitest, vite, esbuild, and Tailwind’s
`chokidar`/`braces` chain). They do **not** affect the production runtime: the backend ships only its
runtime `dependencies`, and the frontend ships a static bundle (no Node modules at runtime). Upgrades
that require breaking major bumps (e.g. vitest v5) were intentionally not forced.
# Vypar
