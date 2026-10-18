import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { Paginated, Payment, PaymentMethod } from '@/types';

export function usePayments(params: { page?: number; limit?: number; customer?: string; from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: qk.paymentList(params),
    queryFn: async () => (await api.get('/payments', { params })).data as Paginated<Payment>,
    placeholderData: keepPreviousData,
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      customerId: string;
      amount: number;
      method?: PaymentMethod;
      invoiceId?: string;
      date?: string;
      notes?: string;
    }) => (await api.post('/payments', body)).data.data as Payment,
    onSuccess: () => {
      // A receipt settles invoices and reduces the customer balance.
      qc.invalidateQueries({ queryKey: qk.payments });
      qc.invalidateQueries({ queryKey: qk.invoices });
      qc.invalidateQueries({ queryKey: qk.customers });
      qc.invalidateQueries({ queryKey: qk.reports });
    },
  });
}
