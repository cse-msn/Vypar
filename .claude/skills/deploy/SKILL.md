---
name: deploy
description: Deploy or configure MNM Fashion to production (frontend on Vercel, backend on Render, MongoDB Atlas, Cloudflare R2, domain garba.store). Use when asked to deploy, go live, set up hosting/domain/env, or debug a production build/deploy.
---

# Production deploy

**Topology:** a **single Render web service** (API + website in one deploy — the backend serves `frontend/dist`,
so the browser is same-origin), **MongoDB Atlas M0**, **Cloudflare R2** for media, domain **garba.store**
(`admin.garba.store` → Render; apex reserved for the future storefront). Full click-by-click: `docs/PRODUCTION_SETUP.md`.

## Key facts
- **Same-origin** → the frontend calls `/api` (relative, no `VITE_API_BASE_URL` needed). Still set
  `CORS_ORIGINS` to the public URL (the browser sends `Origin` on POSTs and the API rejects non-listed origins),
  and `PUBLIC_APP_URL` to the same URL (used in invoice/WhatsApp links).
- R2 bucket stays **private**; the API streams media. `STORAGE_DRIVER=s3`, `S3_ENDPOINT` = R2 endpoint,
  `S3_REGION=auto`, `S3_FORCE_PATH_STYLE=true`.
- Clean first seed: `npm run seed -w backend -- --owner-only` (logins + colours + size groups, no demo data),
  then change default passwords.

## Repo artifacts
- `render.yaml` — single-service blueprint (build `npm run build` = both workspaces, start `npm run start -w backend`,
  health `/api/health`, `JWT_SECRET` auto-generated).
- `Dockerfile` + `.dockerignore` — same single service as a container; deploy to **Cloud Run** for no cold starts
  (`gcloud run deploy --source .`), or Fly/Azure.
- `frontend/tsconfig.build.json` — build/typecheck exclude tests, so `npm run build` is clean.
- `app.ts` resolves `frontend/dist` via `__dirname`, so it serves the site regardless of launch CWD.

## What can't be done from the dev environment
Creating accounts, browser logins, entering cards, and DNS changes are manual (no account-creation/browser tool
here). Prepare code + envs and hand over exact steps; run `npx vercel`/deploy CLIs only if given a token.

## Gotchas
- Render free **spins down after ~15 min idle** → first request ~30–50 s. Upgrade or use Cloud Run if it matters.
- Backend won't boot if env is invalid (zod fail-fast) — check Render logs for the missing var.
- After adding the custom domain, update `CORS_ORIGINS` + `PUBLIC_APP_URL` to `https://admin.garba.store` and redeploy.
- **Blank page / assets 500 with `Origin` header** = `CORS_ORIGINS` doesn't include the site's own URL. Vite marks
  module scripts `crossorigin`, so the browser sends `Origin` even same-origin; set `CORS_ORIGINS` to the exact public
  URL. (The build commands in Render must also be `npm ci --include=dev && npm run build`, or devDeps are skipped and
  Render's global `tsc` fails with `moduleResolution=node10 removed`.)
- The CORS middleware denies unknown origins by withholding headers (not 500-ing), so a misconfig no longer blanks the page.
