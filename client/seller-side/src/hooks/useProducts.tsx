import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Product {
  id: number;
  title: string;
  price: number;
  image_url: string;
  category: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://52.221.195.134/api/';
const backendOrigin = apiBaseUrl.replace(/\/api\/?$/, '');

const normalizeMediaUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${backendOrigin}${url}`;
    return `${backendOrigin}/${url}`;
};

export const useProducts = () => {
    return useQuery({
        queryKey: ['products'],
        queryFn: async (): Promise<Product[]> => {
            try {
                const response = await api.get('/products/');
                
                // Handle paginated response
                const products = response.data.results || response.data;
                
                // Check if products is an array
                if (!Array.isArray(products)) {
                    console.error("API response is not an array:", response.data);
                    return [];
                }
                
                return products.map((p: any) => ({
                    id: p.id,
                    title: p.title || p.name || 'Untitled Product',
                    price: parseFloat(p.price) || 0,
                    image_url: normalizeMediaUrl(p.image_url || p.image) || '/placeholder.svg',
                    category: p.category || p.shop_category || "Uncategorized"
                }));
            } catch (err) {
                console.error("Failed to fetch products", err);
                return [];
            }
        },
    });
};