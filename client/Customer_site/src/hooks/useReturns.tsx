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

interface SubmitReturnData {
  order_id: string;
  reason: string;
  description: string;
  items: { order_item_id: number; quantity: number }[];
}

export const useReturns = () => {
  return useQuery({
    queryKey: ['returns'],
    queryFn: async (): Promise<ReturnRequest[]> => {
      const response = await api.get('/orders/returns/');
      const data = response.data;
      const list = data.results || data;
      return Array.isArray(list) ? list : [];
    },
  });
};

export const useReturn = (returnId: string) => {
  return useQuery({
    queryKey: ['return', returnId],
    queryFn: async (): Promise<ReturnRequest> => {
      const response = await api.get(`/orders/returns/${returnId}/`);
      return response.data;
    },
    enabled: !!returnId,
  });
};

export const useSubmitReturn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SubmitReturnData) => {
      const response = await api.post('/orders/returns/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};
