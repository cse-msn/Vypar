import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { Paginated, Purchase, Supplier } from '@/types';

export function useSuppliers(params: { page?: number; limit?: number; search?: string } = {}) {
  return useQuery({
    queryKey: qk.supplierList(params),
    queryFn: async () => (await api.get('/suppliers', { params })).data as Paginated<Supplier>,
    placeholderData: keepPreviousData,
  });
}

export function useSupplier(id?: string) {
  return useQuery({
    queryKey: qk.supplier(id!),
    queryFn: async () =>
      (await api.get(`/suppliers/${id}`)).data.data as { supplier: Supplier; purchases: Purchase[] },
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Supplier>) => (await api.post('/suppliers', body)).data.data as Supplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.suppliers }),
  });
}

export function useUpdateSupplier(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Supplier>) => (await api.patch(`/suppliers/${id}`, body)).data.data as Supplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.suppliers }),
  });
}
