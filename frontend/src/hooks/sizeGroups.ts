import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { SizeGroup } from '@/types';

export function useSizeGroups() {
  return useQuery({
    queryKey: qk.sizeGroups,
    queryFn: async () => (await api.get('/sizegroups')).data.data as SizeGroup[],
  });
}

type SizeGroupInput = { name: string; sizes: string[] };

export function useCreateSizeGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SizeGroupInput) => (await api.post('/sizegroups', body)).data.data as SizeGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sizeGroups }),
  });
}

export function useUpdateSizeGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<SizeGroupInput>) =>
      (await api.patch(`/sizegroups/${id}`, body)).data.data as SizeGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sizeGroups }),
  });
}

export function useDeleteSizeGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/sizegroups/${id}`)).data.data as SizeGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sizeGroups }),
  });
}
