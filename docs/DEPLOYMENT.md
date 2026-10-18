# Deployment & Production Configuration

This guide covers building and deploying MNM Fashion to production, with **HTTPS** (required for
PWA install, service workers, and camera/barcode access).

---

## 1. Build

```bash
npm install
npm run build        # backend → backend/dist,  frontend → frontend/dist (+ service worker)
```

## 2. Required environment (backend `.env`)

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | API port (e.g. 4000) |
| `MONGODB_URI` | Production MongoDB (e.g. MongoDB Atlas SRV string) |
| `JWT_SECRET` | **Long random secret** — `openssl rand -hex 48` |
| `JWT_EXPIRES_IN` | e.g. `1d` |
| `CORS_ORIGINS` | Exact public web origins, comma-separated (e.g. `https://app.mnmfashion.com`) |
| `PUBLIC_APP_URL` | Public base URL used in WhatsApp/customer links (e.g. `https://app.mnmfashion.com`) |
| `STORAGE_DRIVER` | `s3` in production |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | S3 / compatible creds |
| `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` | Only for MinIO / R2 / Spaces |
| `SHOP_NAME`, `SHOP_ADDRESS`, `SHOP_PHONE`, `SHOP_GSTIN` | Printed on invoices |

Never commit `.env`. Inject secrets via your platform's secret manager.

---

## 3. Deployment topologies

### A) Single service (simplest)
The backend automatically serves `frontend/dist` if it exists (SPA fallback included).
Run one Node process behind an HTTPS reverse proxy.

```bash
npm run build
NODE_ENV=production node backend/dist/index.js    # serves API + website on one port
```

### B) Split hosting (recommended at scale)
- **Frontend**: deploy `frontend/dist` to any static host / CDN (Vercel, Netlify, S3+CloudFront, Nginx).
  Set `VITE_API_BASE_URL` to the API URL (e.g. `https://api.mnmfashion.com/api`) **at build time**,
  or keep `/api` and configure a CDN rewrite/proxy to the API.
- **Backend**: deploy the Node API (Render, Railway, Fly.io, a VM, or a container).
  Set `CORS_ORIGINS` to the static site's origin.

> SPA routing: ensure deep links (`/bill/<token>`, `/invoices/...`) fall back to `index.html`.
> Static hosts usually have an SPA/"rewrite all to index.html" setting.

---

## 4. HTTPS

PWA installability, service workers, and the camera API **require HTTPS** (localhost is exempt).

- **Managed platforms** (Vercel/Netlify/Render/Fly) provide TLS automatically.
- **Self-hosted** — terminate TLS at a reverse proxy. Example **Caddy** (auto Let's Encrypt):

  ```caddyfile
  app.mnmfashion.com {
      encode gzip
      reverse_proxy 127.0.0.1:4000
  }
  ```

  Example **Nginx**:
  ```nginx
  server {
    listen 443 ssl http2;
    server_name app.mnmfashion.com;
    ssl_certificate     /etc/letsencrypt/live/app.mnmfashion.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.mnmfashion.com/privkey.pem;
    client_max_body_size 5m;
    location / { proxy_pass http://127.0.0.1:4000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
  }
  ```
  The API sets `trust proxy` so client IPs (rate limiting) and protocol are read from `X-Forwarded-*`.

---

## 5. Process management (self-hosted)

Use a supervisor so the API restarts on crash/reboot — **pm2**:
```bash
npm i -g pm2
pm2 start backend/dist/index.js --name mnm-api
pm2 save && pm2 startup
```
…or a **systemd** unit running `node /srv/mnm/backend/dist/index.js` with `EnvironmentFile=`.

---

## 6. Object storage (S3-compatible)

1. Create a **private** bucket (block all public access). PDFs are streamed through the API —
   the bucket must **not** be public.
2. Create an IAM user/key with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on that bucket.
3. Set `STORAGE_DRIVER=s3` + the `S3_*` vars.
4. MinIO/R2/Spaces: also set `S3_ENDPOINT` (and `S3_FORCE_PATH_STYLE=true` for MinIO).

---

## 7. Go-live checklist
- [ ] `JWT_SECRET` is long & random; `.env` not in git
- [ ] `MONGODB_URI` points to production DB with auth enabled
- [ ] `CORS_ORIGINS` and `PUBLIC_APP_URL` set to the real HTTPS origin
- [ ] `STORAGE_DRIVER=s3` with a **private** bucket
- [ ] HTTPS working; PWA installs; `/bill/<token>` opens in a fresh browser
- [ ] First owner created; `owner123` seed password changed/removed
- [ ] Backups scheduled (see **BACKUP.md**)
