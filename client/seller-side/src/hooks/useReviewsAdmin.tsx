import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";

export type ReviewStatus = "published" | "pending" | "rejected";

export interface SellerReview {
  id: number;
  product: number | null;
  product_name: string;
  customer: number | null;
  customer_name: string;
  customer_email: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  created_at: string;
}

const QUERY_KEY = ["seller_reviews"];

export const useReviewsAdmin = () =>
  useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<SellerReview[]> => {
      const response = await api.get("/seller/reviews/");
      const data = response.data?.results ?? response.data;
      return Array.isArray(data) ? data : [];
    },
  });

export const useUpdateReviewStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: ReviewStatus }) => {
      const response = await api.patch(`/seller/reviews/${id}/`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

