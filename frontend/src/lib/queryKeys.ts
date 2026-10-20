// Centralised query keys. Keeping entity prefixes stable lets a single
// invalidateQueries({ queryKey: ['products'] }) refresh every products list/detail,
// which is how edits on one device propagate to others after a refetch.
export const qk = {
  products: ['products'] as const,
  productList: (params?: unknown) => ['products', 'list', params] as const,
  product: (id: string) => ['products', 'detail', id] as const,
  productLookup: (params: unknown) => ['products', 'lookup', params] as const,

  customers: ['customers'] as const,
  customerList: (params?: unknown) => ['customers', 'list', params] as const,
  customer: (id: string) => ['customers', 'detail', id] as const,
  customerLedger: (id: string) => ['customers', 'ledger', id] as const,

  suppliers: ['suppliers'] as const,
  supplierList: (params?: unknown) => ['suppliers', 'list', params] as const,
  supplier: (id: string) => ['suppliers', 'detail', id] as const,

  sizeGroups: ['sizeGroups'] as const,

  invoices: ['invoices'] as const,
  invoiceList: (params?: unknown) => ['invoices', 'list', params] as const,
  invoice: (id: string) => ['invoices', 'detail', id] as const,

  purchases: ['purchases'] as const,
  purchaseList: (params?: unknown) => ['purchases', 'list', params] as const,
  purchase: (id: string) => ['purchases', 'detail', id] as const,

  payments: ['payments'] as const,
  paymentList: (params?: unknown) => ['payments', 'list', params] as const,

  reports: ['reports'] as const,
  dashboard: ['reports', 'dashboard'] as const,
  reportSales: (params?: unknown) => ['reports', 'sales', params] as const,
  reportInventory: ['reports', 'inventory'] as const,
  reportFinancial: (params?: unknown) => ['reports', 'financial', params] as const,

  users: ['users'] as const,
};
