import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { Order, Paginated } from '@/types';

export function useOrders(params: { page?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: qk.orderList(params),
    queryFn: async () => (await api.get('/orders', { params })).data as Paginated<Order>,
    placeholderData: keepPreviousData,
  });
}

export function useUpdateOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { status?: Order['status']; paymentStatus?: Order['paymentStatus'] }) =>
      (await api.patch(`/orders/${id}`, body)).data.data as Order,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orders }),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/orders/${id}/cancel`)).data.data as Order,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orders });
      qc.invalidateQueries({ queryKey: qk.products }); // cancel returns stock
    },
  });
}
