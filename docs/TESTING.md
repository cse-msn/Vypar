# Testing & Verification

## Automated tests

```bash
npm test               # backend integration suite (in-memory MongoDB)
npm test -w frontend   # frontend unit/component tests
```

**Backend** (`backend/src/tests/api.test.ts`) verifies, end-to-end against a real (in-memory) Mongo:
- auth: protected routes rejected without a token; invalid credentials rejected; `/me`
- product create (+ auto SKU), barcode lookup, design/colour/size lookup, duplicate-variant rejection
- **billing**: stock deducted atomically, server-computed totals, PDF is a real `%PDF`
- **insufficient stock → 409** with stock unchanged
- **idempotency**: same key ⇒ one invoice, stock deducted once
- **cancel** restores stock
- **public invoice link** serves metadata + PDF **without auth** and hides internal IDs
- payments settle invoice + customer balance; dashboard report

**Frontend** verifies currency/date formatting and UI component rendering/interaction.

## Verified locally (live server + real MongoDB)
A scripted smoke test exercised the running API and confirmed all of the above plus: the WhatsApp
share payload (`wa.me` URL + real link in the message), the served **PWA manifest**, **service
worker**, **icons**, **offline.html**, and **SPA deep-link fallback** (`/bill/<token>`, `/billing`).

---

## Manual cross-device / cross-browser checklist

> ⚠️ Per the project rules, **do not claim a PWA feature works on a platform until verified there.**
> The items below require real devices/browsers. HTTPS is required for install/SW/camera.

### Platforms
- [ ] Desktop Chrome — responsive layout, install, billing, PDF, WhatsApp Web
- [ ] Android Chrome — install prompt, home-screen launch (standalone), camera barcode scan
- [ ] iOS Safari — *Share → Add to Home Screen*, standalone launch, PDF view/download
- [ ] Installed PWA mode (standalone) — navigation, safe-area insets, update prompt
- [ ] Narrow phone screen (≤360px) — bottom nav, tables scroll, touch targets
- [ ] Tablet — two-column layouts

### Functionality
- [ ] Login / session expiry → auto-redirect to login; **logout clears cached data**
- [ ] Create/edit product + variants; stock adjust
- [ ] Fast billing: search + **barcode scan**, discount/tax, part-payment, save
- [ ] PDF: open inline and download (staff + customer link)
- [ ] **WhatsApp**: opens app (mobile) / Web (desktop) with prefilled message + link; fallback copy/share
- [ ] Record customer payment; verify invoice balance + customer due update
- [ ] Purchase: receive stock; cancel reverses stock
- [ ] Reports: sales/inventory/financial render with data

### Connectivity
- [ ] Offline: app shell loads; **offline banner** shows; **billing is blocked** with a clear message
- [ ] Reconnect: actions work again; data refreshes
- [ ] Intermittent network: a retried bill does **not** double-deduct stock (idempotency)

### Cross-device sync (the key check)
- [ ] Sell `Design 104 / Red / 36 ×3` on **device A** → **device B** shows reduced stock after refresh/refetch
- [ ] Owner adds stock on the **website** → the **PWA** reflects it after refresh
- [ ] Open a customer's `/bill/<token>` link in a **separate browser with no login** → it works

### How to test two "devices" locally
Run `npm run dev`, open the app in two browsers (or a desktop browser + phone on the same Wi-Fi
pointing at your machine's LAN IP over HTTPS). Make a sale in one; refresh the other.
