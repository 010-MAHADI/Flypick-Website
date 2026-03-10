import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ReturnItem {
  id: number;
  order_item: number;
  product_title: string;
  product_image: string;
  quantity: number;
  reason: string;
}

export interface ReturnRequest {
  id: number;
  return_id: string;
  order: number;
  order_id: string;
  status: string; // pending, approved, rejected, refunded
  reason: string;
  description: string;
  items: ReturnItem[];
  created_at: string;
  updated_at: string;
  refund_amount?: string;
  admin_note?: string;
}

interface UpdateReturnStatusData {
  returnId: number;
  status: string;
  admin_note?: string;
  refund_amount?: string;
}

export const useReturns = (shopId?: number) => {
  return useQuery({
    queryKey: ['seller-returns', shopId],
    queryFn: async (): Promise<ReturnRequest[]> => {
      const params = shopId ? { shop: shopId } : {};
      const response = await api.get('/orders/returns/', { params });
      const data = response.data;
      const list = data.results || data;
      return Array.isArray(list) ? list : [];
    },
    enabled: !!shopId,
  });
};

export const useReturn = (returnId: string) => {
  return useQuery({
    queryKey: ['seller-return', returnId],
    queryFn: async (): Promise<ReturnRequest> => {
      const response = await api.get(`/orders/returns/${returnId}/`);
      return response.data;
    },
    enabled: !!returnId,
  });
};

export const useUpdateReturnStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateReturnStatusData) => {
      const { returnId, ...payload } = data;
      const response = await api.patch(`/orders/returns/${returnId}/update_status/`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-returns'] });
      queryClient.invalidateQueries({ queryKey: ['seller-return'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};
