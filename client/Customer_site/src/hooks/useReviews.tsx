import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Review {
  id: number;
  user: string;
  user_name?: string;
  date: string;
  rating: number;
  text: string;
  color?: string;
  size?: string;
  helpful: number;
  images?: Array<{ id: number; image: string } | string>;
  created_at?: string;
}

interface ReviewsResponse {
  results?: Review[];
  count?: number;
  average_rating?: number;
}

interface SubmitReviewData {
  productId: number;
  rating: number;
  text: string;
  images?: File[];
}

export const useReviews = (productId: number | string) => {
  return useQuery({
    queryKey: ['reviews', productId],
    queryFn: async (): Promise<{ reviews: Review[]; count: number; averageRating: number }> => {
      const response = await api.get(`/products/${productId}/reviews/`);
      const data: ReviewsResponse = response.data;
      const reviews = data.results || (Array.isArray(data) ? data : []);
      return {
        reviews,
        count: data.count || reviews.length,
        averageRating: data.average_rating || 0,
      };
    },
    enabled: !!productId,
  });
};

export const useSubmitReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, rating, text, images }: SubmitReviewData) => {
      const formData = new FormData();
      formData.append('rating', rating.toString());
      formData.append('text', text);
      if (images) {
        images.forEach((img) => formData.append('images', img));
      }
      const response = await api.post(`/products/${productId}/reviews/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.productId] });
    },
  });
};

export const useMarkHelpful = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, productId }: { reviewId: number; productId: number }) => {
      const response = await api.post(`/products/${productId}/reviews/${reviewId}/helpful/`);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', variables.productId] });
    },
  });
};
