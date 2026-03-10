import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";
import { useAuth } from "./AuthContext";

export interface OrderItem {
  id: number;
  product: number;
  product_title: string;
  product_image: string;
  product_image_url?: string;
  color?: string;
  size?: string;
  quantity: number;
  price: string;
  total_price: string;
  product_details?: any;
}

export interface Order {
  id: number;
  order_id: string;
  customer: number;
  customer_email: string;
  customer_name: string;
  shipping_full_name: string;
  shipping_phone: string;
  shipping_street: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip_code: string;
  shipping_country: string;
  payment_method: string;
  payment_status: string;
  subtotal: string;
  shipping_cost: string;
  discount: string;
  coupon_code: string | null;
  total_amount: string;
  status: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

interface OrderContextType {
  orders: Order[];
  loading: boolean;
  fetchOrders: () => Promise<void>;
  getOrder: (orderId: string) => Order | undefined;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchOrders = async () => {
    if (!user) {
      setOrders([]);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/orders/orders/');
      const data = response.data;
      
      // Handle both paginated and non-paginated responses
      const ordersList = data.results || data;
      setOrders(Array.isArray(ordersList) ? ordersList : []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getOrder = (orderId: string): Order | undefined => {
    return orders.find(order => order.order_id === orderId);
  };

  // Fetch orders when user logs in
  useEffect(() => {
    if (user) {
      fetchOrders();
    } else {
      setOrders([]);
    }
  }, [user]);

  return (
    <OrderContext.Provider value={{ orders, loading, fetchOrders, getOrder }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrders must be used within OrderProvider");
  return ctx;
};
