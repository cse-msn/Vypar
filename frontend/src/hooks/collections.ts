import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { Collection } from '@/types';

export function useCollections() {
  return useQuery({
    queryKey: qk.collections,
    queryFn: async () => (await api.get('/collections')).data.data as Collection[],
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Collection>) => (await api.post('/collections', body)).data.data as Collection,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collections }),
  });
}

export function useUpdateCollection(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Collection>) => (await api.patch(`/collections/${id}`, body)).data.data as Collection,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collections }),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/collections/${id}`)).data.data as Collection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.collections });
      qc.invalidateQueries({ queryKey: qk.products });
    },
  });
}
