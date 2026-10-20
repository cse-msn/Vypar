import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { DashboardSummary } from '@/types';

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: async () => (await api.get('/reports/dashboard')).data.data as DashboardSummary,
    // Dashboard is a live snapshot — refresh it on an interval so numbers stay current.
    refetchInterval: 60_000,
  });
}

export interface SalesReport {
  summary: { totalSales: number; totalCollected: number; totalOutstanding: number; invoiceCount: number; unitsSold: number };
  daily: { date: string; total: number; count: number }[];
  topProducts: { designNumber: string; productName: string; quantity: number; amount: number }[];
  byMethod: { method: string; total: number; collected: number; count: number }[];
}

export function useSalesReport(params: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: qk.reportSales(params),
    queryFn: async () => (await api.get('/reports/sales', { params })).data.data as SalesReport,
  });
}

export interface InventoryReport {
  summary: { totalUnits: number; variantCount: number; costValue: number; retailValue: number; outOfStock: number; lowStockCount: number };
  lowStock: { productId: string; designNumber: string; name: string; color: string; size: string; sku?: string; quantity: number; threshold: number }[];
  byCategory: { category: string; units: number; costValue: number }[];
}

export function useInventoryReport() {
  return useQuery({
    queryKey: qk.reportInventory,
    queryFn: async () => (await api.get('/reports/inventory')).data.data as InventoryReport,
  });
}

export interface FinancialReport {
  periodSales: number;
  periodSalesCollected: number;
  periodSalesCount: number;
  periodPurchases: number;
  periodPurchasesPaid: number;
  periodPurchaseCount: number;
  periodPaymentsReceived: number;
  outstandingReceivable: number;
  outstandingPayable: number;
}

export function useFinancialReport(params: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: qk.reportFinancial(params),
    queryFn: async () => (await api.get('/reports/financial', { params })).data.data as FinancialReport,
  });
}

export interface SupplierStockReport {
  generatedAt: string;
  groups: Array<{
    supplier: string;
    date: string;
    lot: string;
    year: number;
    lines: unknown[];
    totals: { purQty: number; pAmount: number; stockQty: number; diff: number; stockAmt: number };
  }>;
  grand: { purQty: number; pAmount: number; stockQty: number; diff: number; stockAmt: number; lineCount: number };
}

export type SupplierStockParams = { supplier?: string; from?: string; to?: string };

export function useSupplierStockReport(params: SupplierStockParams = {}) {
  return useQuery({
    queryKey: ['reports', 'supplier-stock', params],
    queryFn: async () => (await api.get('/reports/supplier-stock', { params })).data.data as SupplierStockReport,
  });
}

/** Build the `/reports/supplier-stock/pdf` path with the active filters as a query string. */
export function supplierStockPdfPath(params: SupplierStockParams = {}): string {
  const q = new URLSearchParams();
  if (params.supplier) q.set('supplier', params.supplier);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const qs = q.toString();
  return `/reports/supplier-stock/pdf${qs ? `?${qs}` : ''}`;
}

export interface StockListRow {
  designNumber: string;
  designCode: number;
  designName: string;
  category: string;
  color: string;
  size: string;
  itemCode: string;
  stock: number;
  mrp: number;
  value: number;
}
export interface StockListReport {
  generatedAt: string;
  rows: StockListRow[];
  totals: { units: number; value: number; variants: number; designs: number };
}

export function useStockListReport(params: { search?: string } = {}) {
  return useQuery({
    queryKey: ['reports', 'stock-list', params],
    queryFn: async () => (await api.get('/reports/stock-list', { params })).data.data as StockListReport,
  });
}

export function stockListPdfPath(params: { search?: string } = {}): string {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  const qs = q.toString();
  return `/reports/stock-list/pdf${qs ? `?${qs}` : ''}`;
}
