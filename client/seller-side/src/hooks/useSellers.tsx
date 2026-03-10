import { useQuery } from '@tanstack/react-query';
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
}

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

                return sellersRaw.map((seller: any): Seller => {
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
                            category: shop?.category || "General",
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

                    const totalRevenue = shops.reduce((sum, shop) => {
                        const value = Number(String(shop.revenue).replace("$", "")) || 0;
                        return sum + value;
                    }, 0);

                    const totalOrders = shops.reduce((sum, shop) => sum + shop.orders, 0);
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
                        totalRevenue: `$${totalRevenue.toFixed(2)}`,
                        totalOrders,
                        verified: Boolean(seller?.seller_profile?.verified),
                        idDocument: seller?.seller_profile?.idDocument || "N/A",
                        bankAccount: seller?.seller_profile?.bankAccount || "N/A",
                        shops,
                        notes: [],
                    };
                });
            } catch (err) {
                console.error("Failed to fetch sellers from API", err);
                return [];
            }
        },
    });
};
