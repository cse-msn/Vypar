import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from '@/components/Layout';
import { LoadingScreen } from '@/components/ui/spinner';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';

// Heavy / less-frequent pages are code-split so the initial load stays small.
// (Reports pulls in recharts; Billing/StockLookup pull in the barcode scanner.)
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Billing = lazy(() => import('@/pages/Billing'));
const Drafts = lazy(() => import('@/pages/Drafts'));
const Products = lazy(() => import('@/pages/Products'));
const ProductForm = lazy(() => import('@/pages/ProductForm'));
const StockLookup = lazy(() => import('@/pages/StockLookup'));
const Invoices = lazy(() => import('@/pages/Invoices'));
const InvoiceDetail = lazy(() => import('@/pages/InvoiceDetail'));
const Customers = lazy(() => import('@/pages/Customers'));
const Suppliers = lazy(() => import('@/pages/Suppliers'));
const Purchases = lazy(() => import('@/pages/Purchases'));
const PurchaseForm = lazy(() => import('@/pages/PurchaseForm'));
const Payments = lazy(() => import('@/pages/Payments'));
const Reports = lazy(() => import('@/pages/Reports'));
const Settings = lazy(() => import('@/pages/Settings'));
const PublicBill = lazy(() => import('@/pages/PublicBill'));

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/bill/:token" element={<PublicBill />} />

        {/* Authenticated app */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="billing" element={<Billing />} />
            <Route path="drafts" element={<Drafts />} />
            <Route path="products" element={<Products />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/:id/edit" element={<ProductForm />} />
            <Route path="stock" element={<StockLookup />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="purchases/new" element={<PurchaseForm />} />
            <Route path="purchases/:id/edit" element={<PurchaseForm />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="payments" element={<Payments />} />
            <Route path="reports" element={<Reports />} />

            {/* Owner-only */}
            <Route element={<ProtectedRoute roles={['owner']} />}>
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
