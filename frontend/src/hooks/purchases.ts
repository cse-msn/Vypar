import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { Paginated, Purchase } from '@/types';

export interface CreatePurchaseBody {
  supplierId: string;
  supplierBillNo?: string;
  date?: string;
  items: { productId: string; variantId: string; quantity: number; costPrice: number }[];
  discount?: number;
  tax?: number;
  amountPaid?: number;
  notes?: string;
}

export function usePurchases(params: { page?: number; limit?: number; supplier?: string } = {}) {
  return useQuery({
    queryKey: qk.purchaseList(params),
    queryFn: async () => (await api.get('/purchases', { params })).data as Paginated<Purchase>,
    placeholderData: keepPreviousData,
  });
}

export function usePurchase(id?: string) {
  return useQuery({
    queryKey: qk.purchase(id!),
    queryFn: async () => (await api.get(`/purchases/${id}`)).data.data as Purchase,
    enabled: !!id,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreatePurchaseBody) => (await api.post('/purchases', body)).data.data as Purchase,
    onSuccess: () => {
      // Receiving stock changes inventory, supplier balance, and reports.
      qc.invalidateQueries({ queryKey: qk.purchases });
      qc.invalidateQueries({ queryKey: qk.products });
      qc.invalidateQueries({ queryKey: qk.suppliers });
      qc.invalidateQueries({ queryKey: qk.reports });
    },
  });
}

export function useCancelPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/purchases/${id}/cancel`)).data.data as Purchase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.purchases });
      qc.invalidateQueries({ queryKey: qk.products });
      qc.invalidateQueries({ queryKey: qk.suppliers });
      qc.invalidateQueries({ queryKey: qk.reports });
    },
  });
}
