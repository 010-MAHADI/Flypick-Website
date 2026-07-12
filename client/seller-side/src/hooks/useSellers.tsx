import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Shop {
    id: string;
    name: string;
    category: string;
    products: number;
    orders: number;
    revenue: string;
    rating: number;
    status: "active" | "inactive";
    description: string;
    commission: number;
    createdDate: string;
}

export interface Seller {
    id: string;
    name: string;
    email: string;
    phone: string;
    avatar: string;
    joinDate: string;
    location: string;
    address: string;
    status: "active" | "suspended" | "pending" | "rejected";
    totalRevenue: string;
    totalOrders: number;
    verified: boolean;
    idDocument: string;
    bankAccount: string;
    shops: Shop[];
    notes?: { text: string, date: string }[];
    analytics?: SellerAnalytics;
}

export interface ModerationEntry {
    action?: string | null;
    reason?: string;
    moderator?: string | null;
    at?: string | null;
}

export interface AdminSellerProduct {
    id: number;
    name: string;
    status: string;
    isFeatured: boolean;
    price: number;
    image: string | null;
    stock: number;
    sold: number;
    views: number;
    rating: number;
    revenue: number;
    createdAt: string;
    moderation: ModerationEntry | null;
}

export interface SellerAnalytics {
    overview: Record<string, any>;
    sales: Record<string, any>;
    products: {
        counts: Record<string, number>;
        all: AdminSellerProduct[];
    };
    customers: Record<string, any>;
    orders: {
        statusCounts: { status: string; label: string; count: number }[];
        returnRequests: number;
    };
    shopAnalytics: Record<string, any>;
    performance: Record<string, any>;
    documents: Record<string, any>;
    timeline: { type: string; label: string; description: string; createdAt: string }[];
}

const mapSeller = (seller: any): Seller => {
    const shopsRaw = Array.isArray(seller?.shops) ? seller.shops : [];
    const shops: Shop[] = shopsRaw.map((shop: any) => {
        const products = Array.isArray(shop?.products) ? shop.products : [];
        const productCount = products.length;
        const totalOrders = products.reduce((sum: number, product: any) => sum + Number(product?.sold_count || 0), 0);
        const avgRating = productCount
            ? products.reduce((sum: number, product: any) => sum + Number(product?.rating || 0), 0) / productCount
            : 0;

        return {
            id: String(shop?.id ?? ""),
            name: shop?.name || "Shop",
            category: shop?.category_name || shop?.category || "General",
            products: productCount,
            orders: totalOrders,
            revenue: `$${Number(shop?.revenue || 0).toFixed(2)}`,
            rating: Number(avgRating.toFixed(1)),
            status: shop?.status === "inactive" ? "inactive" : "active",
            description: shop?.description || "",
            commission: Number(shop?.commission || 0),
            createdDate: shop?.createdDate || new Date().toISOString(),
        };
    });

    const analytics = seller?.analytics as SellerAnalytics | undefined;
    const totalRevenue = analytics?.sales?.totalRevenue ?? shops.reduce((sum, shop) => {
        const value = Number(String(shop.revenue).replace("$", "")) || 0;
        return sum + value;
    }, 0);
    const totalOrders = analytics?.sales?.totalOrders ?? shops.reduce((sum, shop) => sum + shop.orders, 0);
    const status = seller?.seller_profile?.status || "pending";

    return {
        id: String(seller?.id ?? ""),
        name: seller?.username || seller?.email || "Seller",
        email: seller?.email || "",
        phone: seller?.seller_profile?.phone || "N/A",
        avatar: (seller?.username || seller?.email || "S")[0]?.toUpperCase() || "S",
        joinDate: seller?.date_joined || new Date().toISOString(),
        location: seller?.seller_profile?.location || "N/A",
        address: seller?.seller_profile?.address || "N/A",
        status:
            status === "suspended"
                ? "suspended"
                : status === "active"
                    ? "active"
                    : status === "rejected"
                        ? "rejected"
                        : "pending",
        totalRevenue: `$${Number(totalRevenue || 0).toFixed(2)}`,
        totalOrders: Number(totalOrders || 0),
        verified: Boolean(seller?.seller_profile?.verified),
        idDocument: seller?.seller_profile?.idDocument || "N/A",
        bankAccount: seller?.seller_profile?.bankAccount || "N/A",
        shops,
        notes: seller?.seller_profile?.review_note
            ? [{ text: seller.seller_profile.review_note, date: seller.seller_profile.reviewed_at || seller.date_joined }]
            : [],
        analytics,
    };
};

export const useSellers = () => {
    return useQuery({
        queryKey: ['sellers'],
        queryFn: async (): Promise<Seller[]> => {
            try {
                const response = await api.get('/users/sellers/list/');
                const sellersRaw = response.data?.results ?? response.data;

                if (!Array.isArray(sellersRaw)) {
                    return [];
                }

                return sellersRaw.map(mapSeller);
            } catch (err) {
                console.error("Failed to fetch sellers from API", err);
                return [];
            }
        },
    });
};

export const useSellerDetail = (id?: string) =>
    useQuery({
        queryKey: ['seller_detail', id],
        queryFn: async (): Promise<Seller> => {
            const response = await api.get(`/users/sellers/list/${id}/`);
            return mapSeller(response.data);
        },
        enabled: !!id,
    });

export const useUpdateSellerStatus = (id?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { status?: Seller["status"]; verified?: boolean; review_note?: string }) => {
            const response = await api.put(`/users/sellers/list/${id}/update_status/`, payload);
            return mapSeller(response.data);
        },
        onSuccess: (seller) => {
            queryClient.setQueryData(['seller_detail', id], seller);
            queryClient.invalidateQueries({ queryKey: ['sellers'] });
        },
    });
};

export const useSetShopStatus = (sellerId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { shopId: string; status: "active" | "inactive"; reason?: string }) => {
            const response = await api.put(`/products/shops/${payload.shopId}/set-status/`, {
                status: payload.status,
                reason: payload.reason,
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['seller_detail', sellerId] });
            queryClient.invalidateQueries({ queryKey: ['sellers'] });
        },
    });
};

export const useModerateProduct = (sellerId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: {
            productId: number | string;
            status?: "Active" | "Draft" | "Suspended" | "Rejected";
            is_featured?: boolean;
            reason?: string;
        }) => {
            const response = await api.put(`/products/${payload.productId}/moderate/`, {
                status: payload.status,
                is_featured: payload.is_featured,
                reason: payload.reason,
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['seller_detail', sellerId] });
        },
    });
};
