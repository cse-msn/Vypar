import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'sonner';
import { queryClient, persistOptions } from './lib/queryClient';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

// Dev self-heal: we don't run a service worker in development, so proactively remove any
// stale one (and its caches) left over from a previous PWA dev session. Without this, a
// "zombie" SW keeps serving a cached shell and breaks HMR (ERR_EMPTY_RESPONSE).
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster position="top-center" richColors closeButton duration={3500} />
        </AuthProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
