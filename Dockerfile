# MNM Fashion — single-service production image (API serves the built website).
# Works on Cloud Run, Render, Fly.io, Railway, Azure Container Apps, etc.

# ── Build stage: compile backend + frontend ──────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
# Install all deps (incl. dev) using the lockfile for reproducible builds.
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci
# Build both workspaces.
COPY . .
RUN npm run build

# ── Runtime stage: prod deps + compiled output only ──────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Production dependencies only (hoisted to /app/node_modules by workspaces).
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --omit=dev
# Compiled backend + built website.
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist
# Run from the backend dir so it finds ../frontend/dist and the app boots cleanly.
WORKDIR /app/backend
# The platform injects PORT; the app reads it (defaults to 4000 locally).
EXPOSE 4000
CMD ["node", "dist/index.js"]
