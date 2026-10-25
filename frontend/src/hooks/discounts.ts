import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { Discount, Paginated } from '@/types';

export function useDiscounts(params: { page?: number; limit?: number; search?: string } = {}) {
  return useQuery({
    queryKey: qk.discountList(params),
    queryFn: async () => (await api.get('/discounts', { params })).data as Paginated<Discount>,
    placeholderData: keepPreviousData,
  });
}

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Discount>) => (await api.post('/discounts', body)).data.data as Discount,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.discounts }),
  });
}

export function useUpdateDiscount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Discount>) => (await api.patch(`/discounts/${id}`, body)).data.data as Discount,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.discounts }),
  });
}

export function useDeleteDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/discounts/${id}`)).data.data as Discount,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.discounts }),
  });
}
