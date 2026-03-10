import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";

export type CouponDiscountType = "percent" | "fixed" | "shipping";
export type CouponType = "all_products" | "specific_products" | "category" | "first_order";

export interface SellerCoupon {
  id: number;
  code: string;
  discount_type: CouponDiscountType;
  discount_value: string;
  coupon_type: CouponType;
  category?: number;
  category_name?: string;
  min_order_amount: string;
  selected_products: Array<{id: number; title: string; price: string}>;
  discount: string;
  uses: number;
  max_uses: number;
  expires_at: string;
  is_active: boolean;
  status: string;
}

export interface SellerProduct {
  id: number;
  name: string;
  price: string;
  image: string;
  sold_count: number;
}

export interface SellerCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  image?: string;
  is_active: boolean;
  sort_order: number;
}

interface CouponPayload {
  code: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  coupon_type: CouponType;
  category?: number;
  product_ids?: number[];
  min_order_amount?: number;
  max_uses: number;
  expires_at: string;
  is_active?: boolean;
}

const QUERY_KEY = ["seller_coupons"];

export const useCoupons = (shopId?: string) =>
  useQuery({
    queryKey: ["seller_coupons", shopId],
    queryFn: async (): Promise<SellerCoupon[]> => {
      const params = shopId ? { shop: shopId } : {};
      const response = await api.get("/seller/coupons/", { params });
      const data = response.data?.results ?? response.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!shopId, // Only fetch if shopId is provided
  });

export const useSellerProducts = (shopId?: string) =>
  useQuery({
    queryKey: ["seller_products_for_coupons", shopId],
    queryFn: async (): Promise<SellerProduct[]> => {
      const response = await api.get("/seller/coupons/products/");
      return response.data;
    },
    enabled: !!shopId, // Only fetch if shopId is provided
  });

export const useSellerCategories = (shopId?: string) =>
  useQuery({
    queryKey: ["global_categories_for_coupons", shopId],
    queryFn: async (): Promise<SellerCategory[]> => {
      const response = await api.get("/products/categories/");
      // Handle both paginated and non-paginated responses
      const data = response.data?.results ?? response.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!shopId, // Only fetch if shopId is provided
  });

export const useCreateCoupon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CouponPayload) => {
      const response = await api.post("/seller/coupons/", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

export const useUpdateCoupon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<CouponPayload> }) => {
      const response = await api.put(`/seller/coupons/${id}/`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

export const useToggleCouponStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/seller/coupons/${id}/toggle_status/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

export const useDeleteCoupon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/seller/coupons/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

