# MNM Fashion — API Test Plan

Verifies that **every** backend REST endpoint works: correct status codes, response shape,
auth enforcement, business rules (stock, idempotency), and PDF generation.

There are **two ways** to run it:

| | What | Command |
|---|---|---|
| **Automated** | Hits every endpoint, prints a PASS/FAIL table, and writes a **PDF report** (same format as the shop reports) | `npm run test:api` |
| **Isolated** | In-memory MongoDB integration tests (no running server needed) | `npm test` |
| **Manual** | curl / Postman checklist below | — |

---

## Prerequisites (automated run)
1. MongoDB running and `backend/.env` configured.
2. Seed data present: `npm run seed` (creates `owner@mnm.fashion / owner123`).
3. API running: `npm run dev:api` (or `npm run dev`).
4. In another terminal: `npm run test:api`
   - Target a different host with `API_URL=https://api.example.com/api npm run test:api`.
   - Auth with `API_EMAIL=... API_PASSWORD=... npm run test:api`.
5. Output:
   - Console PASS/FAIL table + summary (exit code `1` if anything failed — CI friendly).
   - `backend/api-test-report.pdf` — formatted report you can print/share.

The runner creates a few throwaway records (prefixed `ZZTEST`) and soft-deletes/cancels them at the end, so it is safe to run against a dev/staging database.

---

## Coverage — endpoints & cases

Legend: **Auth** = bearer token required · **Owner** = owner role required.

### System
| Method | Endpoint | Auth | Expected | Cases |
|---|---|---|---|---|
| GET | `/api/health` | — | 200 `{status:"ok"}` | up |

### Auth
| Method | Endpoint | Auth | Expected | Cases |
|---|---|---|---|---|
| POST | `/api/auth/login` | — | 200 `{token,user}` | valid → 200; wrong password → 401 |
| GET | `/api/auth/me` | ✓ | 200 current user (no passwordHash) | valid token → 200; no token → 401 |
| POST | `/api/auth/register` | Owner* | 201 user | first user bootstraps owner; later needs owner |
| GET | `/api/auth/users` | Owner | 200 list | |
| PATCH | `/api/auth/users/:id` | Owner | 200 updated | can't deactivate self → 400 |

### Products & stock
| Method | Endpoint | Auth | Expected | Cases |
|---|---|---|---|---|
| GET | `/api/products` | ✓ | 200 `{data,meta}` | search, pagination |
| GET | `/api/products/lookup?barcode=` | ✓ | 200 variant | by SKU; unknown → 404 |
| GET | `/api/products/lookup?design=&color=&size=` | ✓ | 200 variant(s) | |
| GET | `/api/products/:id` | ✓ | 200 product | bad id → 400/404 |
| POST | `/api/products` | ✓ | 201 product (auto SKU) | duplicate colour/size → 400 |
| PATCH | `/api/products/:id` | ✓ | 200 updated | |
| POST | `/api/products/:id/variants` | ✓ | 201 | duplicate variant → 400 |
| PATCH | `/api/products/:id/variants/:vid` | ✓ | 200 | |
| POST | `/api/products/:id/variants/:vid/adjust` | ✓ | 200 | `delta`/`setTo`; negative result → 400 |
| DELETE | `/api/products/:id/variants/:vid` | ✓ | 200 | variant with stock → 400 |
| DELETE | `/api/products/:id` | Owner | 200 (soft delete) | |

### Suppliers
| Method | Endpoint | Auth | Expected |
|---|---|---|---|
| GET/POST | `/api/suppliers` | ✓ | 200 / 201 |
| GET/PATCH | `/api/suppliers/:id` | ✓ | 200 |
| DELETE | `/api/suppliers/:id` | Owner | 200 (soft) |

### Customers
| Method | Endpoint | Auth | Expected |
|---|---|---|---|
| GET/POST | `/api/customers` | ✓ | 200 / 201 |
| GET/PATCH | `/api/customers/:id` | ✓ | 200 |
| GET | `/api/customers/:id/ledger` | ✓ | 200 `{customer,invoices,payments}` |
| DELETE | `/api/customers/:id` | Owner | 200 (soft) |

### Purchases (stock-in)
| Method | Endpoint | Auth | Expected | Cases |
|---|---|---|---|---|
| GET | `/api/purchases` | ✓ | 200 | filters |
| GET | `/api/purchases/:id` | ✓ | 200 | |
| POST | `/api/purchases` | ✓ | 201 (stock increases) | |
| POST | `/api/purchases/:id/cancel` | ✓ | 200 (stock reverses) | already-sold → 409 |

### Invoices (billing)
| Method | Endpoint | Auth | Expected | Cases |
|---|---|---|---|---|
| GET | `/api/invoices` | ✓ | 200 | filters (status, payment, dates, search) |
| GET | `/api/invoices/:id` | ✓ | 200 | |
| POST | `/api/invoices` | ✓ | 201 (stock deducts) | **insufficient stock → 409**; **idempotency key retry → 200 duplicate, stock once** |
| POST | `/api/invoices/:id/cancel` | ✓ | 200 (stock restores) | |
| GET | `/api/invoices/:id/pdf` | ✓ | 200 `application/pdf` (`%PDF`) | `?download=1` → attachment |
| POST | `/api/invoices/:id/pdf/regenerate` | ✓ | 200 | |
| GET | `/api/invoices/:id/share` | ✓ | 200 `{whatsappUrl,publicUrl,message}` | `wa.me` + real link |
| POST | `/api/invoices/:id/revoke-link` | ✓ | 200 | revoke/rotate token |

### Payments
| Method | Endpoint | Auth | Expected |
|---|---|---|---|
| GET/POST | `/api/payments` | ✓ | 200 / 201 (settles invoice + customer balance) |
| GET | `/api/payments/:id` | ✓ | 200 |

### Reports
| Method | Endpoint | Auth | Expected |
|---|---|---|---|
| GET | `/api/reports/dashboard` | ✓ | 200 summary |
| GET | `/api/reports/sales?from=&to=` | ✓ | 200 `{summary,daily,topProducts}` |
| GET | `/api/reports/inventory` | ✓ | 200 `{summary,lowStock,byCategory}` |
| GET | `/api/reports/financial?from=&to=` | ✓ | 200 receivables/payables |
| GET | `/api/reports/supplier-stock` | ✓ | 200 grouped report |
| GET | `/api/reports/supplier-stock/pdf` | ✓ | 200 `application/pdf` (`%PDF`) |

### Public (no auth — customer links)
| Method | Endpoint | Auth | Expected | Cases |
|---|---|---|---|---|
| GET | `/api/public/invoices/:token` | — | 200 metadata (no internal IDs) | unknown token → 404 |
| GET | `/api/public/invoices/:token/pdf` | — | 200 `%PDF` | |

### Security / negative
| Case | Expected |
|---|---|
| Any protected route without token | 401 |
| Staff hits owner-only route | 403 |
| Validation failure (bad body) | 400 with field errors |

---

## Manual spot-check (curl)
```bash
API=http://localhost:4000/api
TOKEN=$(curl -s $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"owner@mnm.fashion","password":"owner123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["token"])')

curl -s $API/health
curl -s $API/products -H "Authorization: Bearer $TOKEN" | head -c 300
curl -s "$API/reports/supplier-stock" -H "Authorization: Bearer $TOKEN" | head -c 300
curl -s $API/products        # → 401 (no token)
```

## Exit criteria
All automated checks **PASS** (runner exits `0`), the generated PDF shows 0 failures, and the
manual spot-checks return the expected status codes.
