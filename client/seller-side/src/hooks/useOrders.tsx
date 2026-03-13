import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface OrderItemApi {
    id: number;
    product: number | null;
    product_title: string;
    product_image_url?: string | null;
    color?: string | null;
    size?: string | null;
    quantity: number;
    price: number | string;
}

export interface Order {
    id: string;
    customer_name: string;
    customer_email: string;
    shipping_phone?: string;
    shipping_street?: string;
    shipping_city?: string;
    shipping_state?: string;
    shipping_zip_code?: string;
    shipping_country?: string;
    date: string;
    status: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
    payment_status: string;
    total: number;
    paymentMethod: string;
    items: OrderItemApi[];
}

const mapStatus = (status: string): Order["status"] => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "completed" || normalized === "delivered") return "Delivered";
    if (normalized === "shipped") return "Shipped";
    if (normalized === "processing") return "Processing";
    if (normalized === "cancelled") return "Cancelled";
    return "Pending";
};

export const useOrders = (shopId?: string) => {
    return useQuery({
        queryKey: ['admin_orders', shopId],
        queryFn: async (): Promise<Order[]> => {
            try {
                const params = shopId ? { shop: shopId } : {};
                const response = await api.get('/orders/orders/', { params });
                const data = response.data?.results ?? response.data;

                if (!Array.isArray(data)) {
                    return [];
                }

                return data.map((order: any) => ({
                    id: String(order.order_id ?? order.id ?? ""),
                    customer_name: order.customer_name || "Guest",
                    customer_email: order.customer_email || "",
                    shipping_phone: order.shipping_phone || "",
                    shipping_street: order.shipping_street || "",
                    shipping_city: order.shipping_city || "",
                    shipping_state: order.shipping_state || "",
                    shipping_zip_code: order.shipping_zip_code || "",
                    shipping_country: order.shipping_country || "",
                    date: new Date(order.created_at).toLocaleDateString(),
                    status: mapStatus(order.status),
                    payment_status: order.payment_status || "pending",
                    total: parseFloat(order.total_amount),
                    paymentMethod: order.payment_method || "Unknown",
                    items: Array.isArray(order.items) ? order.items : [],
                }));
            } catch (err) {
                console.error("Failed to fetch orders", err);
                return [];
            }
        },
        enabled: !!shopId,
    });
};

export const useUpdateOrderStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ orderApiId, status }: { orderApiId: string; status: string }) => {
            const response = await api.patch(`/orders/orders/${orderApiId}/`, {
                status: status
            });
            return response.data;
        },
        onSuccess: () => {
            // Invalidate and refetch orders
            queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
        },
        onError: (error) => {
            console.error('Failed to update order status:', error);
        }
    });
};