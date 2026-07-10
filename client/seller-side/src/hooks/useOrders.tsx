import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface OrderItemApi {
    id: number;
    product: number | null;
    product_title: string;
    product_image_url?: string | null;
    color?: string | null;
    size?: string | null;
    shipping_type?: string | null;
    quantity: number;
    price: number | string;
    product_details?: {
        variants?: {
            shippingOptions?: Array<{ type: string; enabled: boolean; price?: number }>;
        };
    } | null;
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
    createdAtIso: string;
    status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
    /** Exact backend lifecycle status (confirmed, packed, out_for_delivery, …) */
    raw_status: string;
    payment_status: string;
    subtotal?: number;
    shipping_cost?: number;
    discount?: number;
    total: number;
    paymentMethod: string;
    items: OrderItemApi[];
    order_notes?: string;
    delivery_instructions?: string;
    tracking_number?: string;
    courier_name?: string;
    cancellation_reason?: string;
}

// The page groups the full lifecycle into 5 display buckets
const mapStatus = (status: string): Order["status"] => {
    const normalized = (status || "").toLowerCase();
    if (["delivered", "completed"].includes(normalized)) return "delivered";
    if (["shipped", "out_for_delivery"].includes(normalized)) return "shipped";
    if (["confirmed", "processing", "packed"].includes(normalized)) return "processing";
    if (["cancelled", "failed", "returned", "refunded"].includes(normalized)) return "cancelled";
    return "pending";
};

export const useOrders = (shopId?: string | number) => {
    return useQuery({
        queryKey: ['admin_orders', shopId],
        queryFn: async (): Promise<Order[]> => {
            try {
                const params = shopId ? { shop: shopId } : {};
                console.log('Fetching orders with params:', params);
                
                const response = await api.get('/orders/orders/', { params });
                console.log('Orders API response:', response);
                
                const data = response.data?.results ?? response.data;
                console.log('Raw orders data:', { data, shopId, params });

                if (!Array.isArray(data)) {
                    console.warn('Orders data is not an array:', data);
                    return [];
                }

                const mappedOrders = data.map((order: any) => {
                    console.log('Mapping order:', { 
                        raw_order: order,
                        order_id: order.order_id, 
                        id: order.id, 
                        items_count: order.items?.length,
                        total_amount: order.total_amount 
                    });
                    
                    return {
                        api_id: Number(order.id) || 0,  // This should be the database ID
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
                        createdAtIso: order.created_at || new Date().toISOString(),
                        status: mapStatus(order.status),
                        raw_status: order.status || "pending",
                        order_notes: order.order_notes || "",
                        delivery_instructions: order.delivery_instructions || "",
                        tracking_number: order.tracking_number || "",
                        courier_name: order.courier_name || "",
                        cancellation_reason: order.cancellation_reason || "",
                        payment_status: order.payment_status || "pending",
                        subtotal: parseFloat(order.subtotal) || 0,
                        shipping_cost: parseFloat(order.shipping_cost) || 0,
                        discount: parseFloat(order.discount) || 0,
                        total: parseFloat(order.total_amount) || 0,
                        paymentMethod: order.payment_method || "Unknown",
                        items: Array.isArray(order.items) ? order.items : [],
                    };
                });

                console.log('Mapped orders:', mappedOrders.length, mappedOrders);
                return mappedOrders;
            } catch (err: any) {
                console.error("Failed to fetch orders", err);
                if (err.response) {
                    console.error("Error response:", err.response.status, err.response.data);
                }
                return [];
            }
        },
        enabled: true,  // Always enable for sellers
        staleTime: 30000, // 30 seconds
        refetchOnWindowFocus: false,
    });
};

export const useUpdateOrderStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            orderApiId,
            status,
            note,
            trackingNumber,
            courierName,
        }: {
            orderApiId: number | string;
            status: string;
            note?: string;
            trackingNumber?: string;
            courierName?: string;
        }) => {
            const id = typeof orderApiId === 'string' ? orderApiId : String(orderApiId);
            const payload: Record<string, string> = { status: status.toLowerCase() };
            if (note) payload.note = note;
            if (trackingNumber) payload.tracking_number = trackingNumber;
            if (courierName) payload.courier_name = courierName;

            // The lifecycle endpoint validates transitions, writes the audit
            // trail and notifies the customer.
            const response = await api.post(`/orders/orders/${id}/update_status/`, payload);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
        },
    });
};

/** Record an offline payment (COD collected, etc.) — persists server-side. */
export const useMarkOrderPaid = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ orderApiId, paymentMethod, note }: { orderApiId: number | string; paymentMethod: string; note?: string }) => {
            const response = await api.post(`/orders/orders/${orderApiId}/mark_paid/`, {
                payment_method: paymentMethod,
                note: note || '',
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
        },
    });
};

export interface RefundApi {
    id: number;
    refund_id: string;
    order_id: string;
    amount: string;
    refund_type: string;
    method: string;
    status: string;
    reason: string;
    created_at: string;
}

/** Refund cases for the seller's/admin's orders. */
export const useRefunds = () => {
    return useQuery({
        queryKey: ['seller_refunds'],
        queryFn: async (): Promise<RefundApi[]> => {
            const response = await api.get('/orders/refunds/');
            const data = response.data?.results ?? response.data;
            return Array.isArray(data) ? data : [];
        },
    });
};

/** Seller/admin processes a refund (full or partial) — moves money now. */
export const useProcessRefund = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ orderId, reason, method, amount }: { orderId: string; reason: string; method: string; amount?: number }) => {
            const payload: Record<string, unknown> = { order_id: orderId, reason, method };
            if (amount !== undefined) payload.amount = amount;
            const response = await api.post('/orders/refunds/', payload);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
            queryClient.invalidateQueries({ queryKey: ['seller_refunds'] });
        },
    });
};
