import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { Invoice, InvoiceShare, Paginated, PaymentMethod } from '@/types';

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  search?: string;
  customer?: string;
  status?: 'confirmed' | 'cancelled';
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
  from?: string;
  to?: string;
}

export interface CreateInvoiceBody {
  items: { productId: string; variantId: string; quantity: number; price?: number; discount?: number }[];
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  roundOff?: boolean;
  amountPaid?: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  idempotencyKey: string;
}

export function useInvoices(params: InvoiceListParams = {}) {
  return useQuery({
    queryKey: qk.invoiceList(params),
    queryFn: async () => (await api.get('/invoices', { params })).data as Paginated<Invoice>,
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id?: string) {
  return useQuery({
    queryKey: qk.invoice(id!),
    queryFn: async () => (await api.get(`/invoices/${id}`)).data.data as Invoice,
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateInvoiceBody) => {
      const res = await api.post('/invoices', body, { headers: { 'Idempotency-Key': body.idempotencyKey } });
      return res.data as { data: Invoice; duplicate: boolean };
    },
    onSuccess: () => {
      // A sale changes stock, customer balance, and all summary numbers.
      qc.invalidateQueries({ queryKey: qk.invoices });
      qc.invalidateQueries({ queryKey: qk.products });
      qc.invalidateQueries({ queryKey: qk.customers });
      qc.invalidateQueries({ queryKey: qk.reports });
    },
  });
}

export function useCancelInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (await api.post(`/invoices/${id}/cancel`, { reason })).data.data as Invoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invoices });
      qc.invalidateQueries({ queryKey: qk.products });
      qc.invalidateQueries({ queryKey: qk.customers });
      qc.invalidateQueries({ queryKey: qk.reports });
    },
  });
}

/** Ensure the PDF exists and get the prefilled WhatsApp payload for an invoice. */
export async function fetchInvoiceShare(id: string): Promise<InvoiceShare> {
  const res = await api.get(`/invoices/${id}/share`);
  return res.data.data as InvoiceShare;
}
