import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { Color } from '@/types';

export function useColors() {
  return useQuery({
    queryKey: qk.colors,
    queryFn: async () => (await api.get('/colors')).data.data as Color[],
  });
}

export function useCreateColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string }) => (await api.post('/colors', body)).data.data as Color,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.colors }),
  });
}

export function useUpdateColor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string }) => (await api.patch(`/colors/${id}`, body)).data.data as Color,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.colors }),
  });
}

export function useDeleteColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/colors/${id}`)).data.data as Color,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.colors }),
  });
}
