import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'node:path';

// The in-app barcode scanner uses the camera (getUserMedia), which browsers only
// expose in a secure context. On localhost plain http is already a secure context, so
// normal dev needs NO https. Only a phone/tablet reaching the dev server over the shop
// Wi-Fi (http://192.168.x.x) needs it. So HTTPS is OPT-IN to keep plain localhost working:
//   VITE_HTTPS=true npm run dev   → serve over https (accept the self-signed cert) for LAN camera testing
const useHttps = process.env.VITE_HTTPS === 'true';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // Listen on all interfaces so phones/tablets on the same Wi-Fi can reach the dev
    // server by LAN IP (needed to test the camera scanner on a real device).
    // HTTPS itself is provided by the conditional basic-ssl plugin below.
    host: true,
    // Proxy API calls to the backend in dev → same-origin for the browser (no CORS).
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 4173 },
  plugins: [
    react(),
    // Self-signed HTTPS for dev so the camera scanner works on phones over the LAN.
    // Omitted when VITE_HTTPS=false (Vite ignores falsy entries in this array).
    useHttps && basicSsl(),
    VitePWA({
      // "prompt" → we surface a controlled "Update available" banner instead of
      // auto-reloading, so an update never interrupts an in-progress bill.
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'offline.html', 'robots.txt', 'favicon.svg'],
      manifest: {
        name: 'MNM Fashion',
        short_name: 'MNM Fashion',
        description: 'Inventory, billing & stock management for MNM Fashion.',
        theme_color: '#A61E57',
        background_color: '#FBF8FA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell + static assets only.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // SPA routes resolve to the cached shell when offline...
        navigateFallback: 'index.html',
        // ...but API calls must always hit the network (never serve the shell for them).
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          // Non-sensitive remote product images — safe to cache.
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'mnm-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // IMPORTANT: authenticated/financial API responses (incl. invoice PDFs) are
          // intentionally NOT cached by the service worker. Offline reads of previously
          // viewed data are handled by TanStack Query's persisted cache, which is cleared
          // on logout. See src/lib/queryClient.ts and SECURITY notes in README.
        ],
      },
      devOptions: {
        // Keep the service worker OFF in dev. A dev SW caches aggressively and, if the
        // dev server restarts/stops, serves a stale "zombie" shell (ERR_EMPTY_RESPONSE
        // for /@vite/client, /src/main.tsx, etc.). Test install/offline against the built
        // app instead:  npm run build && npm run preview.
        enabled: false,
        suppressWarnings: true,
        type: 'module',
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the two heaviest leaf libraries into their own chunks (they're only used on a
        // few routes), so the main bundle stays small. These are leaves → no circular chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'charts';
          if (id.includes('@zxing')) return 'scanner';
          return undefined;
        },
      },
    },
  },
});
