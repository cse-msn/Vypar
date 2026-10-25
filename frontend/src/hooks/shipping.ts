import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { ShippingZone } from '@/types';

export function useShippingZones() {
  return useQuery({
    queryKey: qk.shipping,
    queryFn: async () => (await api.get('/shipping')).data.data as ShippingZone[],
  });
}

export function useCreateShippingZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<ShippingZone>) => (await api.post('/shipping', body)).data.data as ShippingZone,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shipping }),
  });
}

export function useUpdateShippingZone(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<ShippingZone>) => (await api.patch(`/shipping/${id}`, body)).data.data as ShippingZone,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shipping }),
  });
}

export function useDeleteShippingZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/shipping/${id}`)).data.data as ShippingZone,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shipping }),
  });
}
