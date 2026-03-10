import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  image_url: string | null;
  parent: number | null;
  is_active: boolean;
  sort_order: number;
}

interface CategoryPayload {
  name: string;
  description?: string;
  image?: string;
  parent?: number | null;
  is_active?: boolean;
  sort_order?: number;
}

const QUERY_KEY = ["categories"];

export const useCategories = () =>
  useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<Category[]> => {
      const response = await api.get("/products/categories/");
      const data = response.data?.results ?? response.data;
      return Array.isArray(data) ? data : [];
    },
  });

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CategoryPayload) => {
      const response = await api.post("/products/categories/", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<CategoryPayload> }) => {
      const response = await api.patch(`/products/categories/${id}/`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/products/categories/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

export const useUploadCategoryImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ categoryId, file }: { categoryId: number; file: File }) => {
      const formData = new FormData();
      formData.append('category_id', categoryId.toString());
      formData.append('image', file);
      
      const response = await api.post('/products/upload-category-image/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

