import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Draft } from '@/types';

const draftsKey = ['drafts'] as const;

export function useDrafts() {
  return useQuery({
    queryKey: draftsKey,
    queryFn: async () => (await api.get('/drafts')).data.data as Draft[],
  });
}

export async function fetchDraft(id: string): Promise<Draft> {
  return (await api.get(`/drafts/${id}`)).data.data as Draft;
}

export interface SaveDraftPayload {
  id?: string | null;
  data: unknown;
  customerName: string;
  itemCount: number;
  total: number;
}

/** Create (no id) or replace (id) a draft. Returns the saved draft. */
export async function saveDraft({ id, ...body }: SaveDraftPayload): Promise<Draft> {
  const res = id ? await api.put(`/drafts/${id}`, body) : await api.post('/drafts', body);
  return res.data.data as Draft;
}

export async function deleteDraft(id: string): Promise<void> {
  await api.delete(`/drafts/${id}`);
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDraft(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftsKey }),
  });
}
