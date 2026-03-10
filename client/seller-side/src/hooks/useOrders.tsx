import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    api_id: number;
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

export const useOrders = (shopId?: number) => {
    return useQuery({
        queryKey: ['admin_orders', shopId ?? 'all'],
        queryFn: async (): Promise<Order[]> => {
            try {
                const response = await api.get('/orders/orders/');
                const data = response.data?.results ?? response.data;

                if (!Array.isArray(data)) {
                    return [];
                }

                return data.map((order: any) => ({
                    api_id: Number(order.id),
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
    });
};

const toBackendStatus = (status: Order["status"]) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "processing") return "processing";
    if (normalized === "shipped") return "shipped";
    if (normalized === "delivered") return "delivered";
    if (normalized === "cancelled") return "cancelled";
    return "pending";
};

export const useUpdateOrderStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ orderApiId, status }: { orderApiId: number; status: Order["status"] }) => {
            const response = await api.patch(`/orders/orders/${orderApiId}/`, {
                status: toBackendStatus(status),
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin_orders"] });
        },
    });
};
