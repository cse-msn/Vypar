---
name: dev
description: Start the MNM Fashion app locally (backend API + frontend web) and verify it's running. Use when asked to run, start, serve, or boot the app / dev servers, or to confirm a change works in the real app.
---

# Run MNM Fashion locally

This is an npm-workspaces monorepo (`backend/` + `frontend/`). The backend is the source of truth and needs MongoDB.

## Prerequisites
- **MongoDB must be running** and reachable at `backend/.env`'s `MONGODB_URI` (default `mongodb://127.0.0.1:27017`). The backend validates its env on boot and **refuses to start** if the DB/env is wrong — so if startup fails with a MongooseServerSelectionError, start MongoDB first.
- Run `npm install` at the repo root once (installs both workspaces).

## Start both servers
From the repo root:
```bash
npm run dev          # API on http://localhost:4000, web on http://localhost:5173 (concurrently)
```
Or individually: `npm run dev:api` / `npm run dev:web`. When driving the servers yourself in a tool call, start them in the background and read the output file for the ready lines:
- API ready line: `MNM Fashion API listening on http://localhost:4000`
- Web ready line: Vite prints `Local: http://localhost:5173/`

## Verify it's up
- Health: `GET http://localhost:4000/api/health` → `{ status: "ok" }`.
- Seed logins (after `npm run seed`): owner `owner@mnm.fashion` / `owner123`, staff `staff@mnm.fashion` / `staff123`.

## Mobile / camera scanning on the LAN
The barcode scanner needs a secure context. Plain `localhost` works; a phone reaching the dev server by LAN IP needs HTTPS:
```bash
VITE_HTTPS=true npm run dev:web   # then open https://<PC-LAN-IP>:5173 and accept the self-signed cert
```
