import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { Customer, Invoice, Paginated, Payment } from '@/types';

export function useCustomers(params: { page?: number; limit?: number; search?: string } = {}) {
  return useQuery({
    queryKey: qk.customerList(params),
    queryFn: async () => (await api.get('/customers', { params })).data as Paginated<Customer>,
    placeholderData: keepPreviousData,
  });
}

export function useCustomerLedger(id?: string) {
  return useQuery({
    queryKey: qk.customerLedger(id!),
    queryFn: async () =>
      (await api.get(`/customers/${id}/ledger`)).data.data as {
        customer: Customer;
        invoices: Invoice[];
        payments: Payment[];
      },
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Customer>) => (await api.post('/customers', body)).data.data as Customer,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.customers }),
  });
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Customer>) => (await api.patch(`/customers/${id}`, body)).data.data as Customer,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.customers }),
  });
}
