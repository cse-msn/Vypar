import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import type { Paginated, Product } from '@/types';

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  includeInactive?: boolean;
  inStock?: boolean;
}

export function useProducts(params: ProductListParams = {}) {
  return useQuery({
    queryKey: qk.productList(params),
    queryFn: async () => (await api.get('/products', { params })).data as Paginated<Product>,
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id?: string) {
  return useQuery({
    queryKey: qk.product(id!),
    queryFn: async () => (await api.get(`/products/${id}`)).data.data as Product,
    enabled: !!id,
  });
}

/** Imperative stock lookup (barcode scan or design/colour/size). */
export async function lookupProduct(params: {
  barcode?: string;
  sku?: string;
  design?: string;
  color?: string;
  size?: string;
}) {
  const res = await api.get('/products/lookup', { params });
  return res.data.data as { product: Product; variant?: Product['variants'][number]; matches: Product['variants'] };
}

function useInvalidateProducts() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.products });
    qc.invalidateQueries({ queryKey: qk.reports });
  };
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (body: Partial<Product>) => (await api.post('/products', body)).data.data as Product,
    onSuccess: invalidate,
  });
}

export function useUpdateProduct(id: string) {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (body: Partial<Product>) => (await api.patch(`/products/${id}`, body)).data.data as Product,
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/products/${id}`)).data,
    onSuccess: invalidate,
  });
}

export function useAddVariant(productId: string) {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (body: Partial<Product['variants'][number]>) =>
      (await api.post(`/products/${productId}/variants`, body)).data.data as Product,
    onSuccess: invalidate,
  });
}

export function useUpdateVariant(productId: string) {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async ({ variantId, body }: { variantId: string; body: Partial<Product['variants'][number]> }) =>
      (await api.patch(`/products/${productId}/variants/${variantId}`, body)).data.data as Product,
    onSuccess: invalidate,
  });
}

export function useAdjustStock(productId: string) {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async ({ variantId, delta, setTo, reason }: { variantId: string; delta?: number; setTo?: number; reason?: string }) =>
      (await api.post(`/products/${productId}/variants/${variantId}/adjust`, { delta, setTo, reason })).data.data as Product,
    onSuccess: invalidate,
  });
}
