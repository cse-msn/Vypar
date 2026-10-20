---
name: seed
description: Seed or reset the MNM Fashion dev database. Use when asked to seed, reseed, reset, repopulate, or wipe the database, or to create the default owner/staff logins and sample data.
---

# Seed the dev database

Requires MongoDB running (see the `dev` skill). All commands from the repo root.

```bash
npm run seed                      # idempotent: ensures owner/staff users; adds sample data ONLY if the catalogue is empty
npm run seed -w backend -- --fresh   # DESTRUCTIVE: wipes all collections first, then seeds from scratch
npm run seed:more -w backend      # append extra dummy data (addDummyData.ts)
```

## What it creates
- **Logins:** owner `owner@mnm.fashion` / `owner123`, staff `staff@mnm.fashion` / `staff123` (change after first login).
- Sample suppliers, customers, products (with variants + auto-generated SKUs/barcodes), purchases, invoices, payments, and the default **size groups**.

## Notes
- Re-running without `--fresh` never duplicates business data (it skips sample data when products already exist) — safe to run repeatedly.
- Use `--fresh` only when you intend to discard all existing data (confirm with the user first — it's destructive).
- Script: `backend/src/scripts/seed.ts`.
