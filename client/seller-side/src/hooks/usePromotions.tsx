import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Product {
  id: number;
  title: string;
  price: number;
  image_url: string;
  category: string;
}

export interface PromotionCampaign {
  id: number;
  title: string;
  message: string;
  email_subject?: string;
  channel: 'email' | 'notification' | 'both';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'active' | 'paused' | 'completed' | 'failed';
  audience: 'all' | 'returning' | 'new' | 'inactive' | 'high_value';
  products?: Product[];
  product_ids?: number[];
  shop: number;
  shop_name: string;
  created_by: number;
  created_by_name: string;
  scheduled_at?: string;
  sent_at?: string;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  open_rate: number;
  click_rate: number;
  created_at: string;
  updated_at: string;
}

export interface PromotionStats {
  total_campaigns: number;
  sent_campaigns: number;
  scheduled_campaigns: number;
  draft_campaigns: number;
  avg_open_rate: number;
  avg_click_rate: number;
  total_sent: number;
  total_revenue: number;
}

export interface PromotionTemplate {
  id: number;
  name: string;
  title_template: string;
  message_template: string;
  email_subject_template?: string;
  channel: 'email' | 'notification' | 'both';
  audience: 'all' | 'returning' | 'new' | 'inactive' | 'high_value';
  template_variables: Record<string, any>;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export interface CreateCampaignData {
  title: string;
  message: string;
  email_subject?: string;
  channel: 'email' | 'notification' | 'both';
  audience: 'all' | 'returning' | 'new' | 'inactive' | 'high_value';
  product_ids: number[];
  scheduled_at?: string;
}

export interface SendCampaignData {
  send_immediately?: boolean;
  scheduled_at?: string;
  test_email?: string;
}

// Hooks
export const usePromotions = () => {
  return useQuery({
    queryKey: ['promotions'],
    queryFn: async (): Promise<PromotionCampaign[]> => {
      const response = await api.get('/promotions/campaigns/');
      const data = response.data.results || response.data;
      
      // Ensure products array exists for each promotion
      return Array.isArray(data) ? data.map(promo => ({
        ...promo,
        products: promo.products || []
      })) : [];
    },
  });
};

export const usePromotion = (id: number) => {
  return useQuery({
    queryKey: ['promotion', id],
    queryFn: async (): Promise<PromotionCampaign> => {
      const response = await api.get(`/promotions/campaigns/${id}/`);
      const data = response.data;
      
      // Ensure products array exists
      return {
        ...data,
        products: data.products || []
      };
    },
    enabled: !!id,
  });
};

export const usePromotionStats = () => {
  return useQuery({
    queryKey: ['promotion-stats'],
    queryFn: async (): Promise<PromotionStats> => {
      const response = await api.get('/promotions/campaigns/stats/');
      return response.data;
    },
  });
};

export const usePromotionTemplates = () => {
  return useQuery({
    queryKey: ['promotion-templates'],
    queryFn: async (): Promise<PromotionTemplate[]> => {
      const response = await api.get('/promotions/templates/');
      return response.data.results || response.data;
    },
  });
};

export const useCreatePromotion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateCampaignData): Promise<PromotionCampaign> => {
      const response = await api.post('/promotions/campaigns/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
    },
  });
};

export const useUpdatePromotion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateCampaignData> }): Promise<PromotionCampaign> => {
      const response = await api.patch(`/promotions/campaigns/${id}/`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['promotion', data.id] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
    },
  });
};

export const useDeletePromotion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/promotions/campaigns/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
    },
  });
};

export const useSendPromotion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: SendCampaignData }): Promise<any> => {
      const response = await api.post(`/promotions/campaigns/${id}/send/`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['promotion', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
    },
  });
};

export const useDuplicatePromotion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number): Promise<PromotionCampaign> => {
      const response = await api.post(`/promotions/campaigns/${id}/duplicate/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
    },
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<PromotionTemplate, 'id' | 'created_by' | 'created_by_name' | 'created_at'>): Promise<PromotionTemplate> => {
      const response = await api.post('/promotions/templates/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotion-templates'] });
    },
  });
};

export const useCampaignStatus = (id: number) => {
  return useQuery({
    queryKey: ['campaign-status', id],
    queryFn: async (): Promise<{
      id: number;
      status: string;
      sent_count: number;
      delivered_count: number;
      sent_at?: string;
      updated_at: string;
    }> => {
      const response = await api.get(`/promotions/campaigns/${id}/status/`);
      return response.data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      // Refetch every 2 seconds if status is 'sending'
      return query.state.data?.status === 'sending' ? 2000 : false;
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/promotions/templates/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotion-templates'] });
    },
  });
};