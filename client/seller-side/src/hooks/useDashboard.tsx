import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export type DashboardRange = 'today' | 'week' | 'month' | 'year' | 'all';

export interface DashboardStatValues {
  totalSales: number;
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  refundedOrders: number;
  productCost: number;
  deliveryCost: number;
  expenses: number;
  netProfit: number;
  activeProducts: number;
  lowStockProducts: number;
  // admin-only
  totalCustomers?: number;
  newCustomers?: number;
  totalSellers?: number;
  activeSellers?: number;
  pendingSellerRequests?: number;
  activeUsers?: number;
}

export interface DashboardStats {
  range: DashboardRange;
  stats: DashboardStatValues;
  recentOrders: {
    id: number | string;
    customer: string;
    product?: string;
    amount: number;
    status: string;
    date: string;
  }[];
  revenueData: { label: string; revenue: number }[];
  categoryData: { name: string; value: number }[];
  topProducts: { name: string; sold: number; revenue: number }[];
}

const EMPTY_STATS: DashboardStatValues = {
  totalSales: 0, totalRevenue: 0, totalOrders: 0, pendingOrders: 0,
  processingOrders: 0, shippedOrders: 0, deliveredOrders: 0, completedOrders: 0,
  cancelledOrders: 0, returnedOrders: 0, refundedOrders: 0, productCost: 0,
  deliveryCost: 0, expenses: 0, netProfit: 0, activeProducts: 0, lowStockProducts: 0,
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const useDashboard = (shopId?: string, range: DashboardRange = 'all') => {
  return useQuery({
    queryKey: ['dashboard_stats', shopId, range],
    queryFn: async (): Promise<DashboardStats> => {
      const params: Record<string, string> = { range };
      if (shopId) params.shop = shopId;
      const { data } = await api.get('/users/dashboard/stats/', { params });
      const s = data?.stats || {};

      const stats: DashboardStatValues = { ...EMPTY_STATS };
      (Object.keys(EMPTY_STATS) as (keyof DashboardStatValues)[]).forEach((k) => {
        stats[k] = num(s[k]);
      });
      // Admin-only optional fields.
      (['totalCustomers', 'newCustomers', 'totalSellers', 'activeSellers',
        'pendingSellerRequests', 'activeUsers'] as (keyof DashboardStatValues)[])
        .forEach((k) => { if (s[k] !== undefined) stats[k] = num(s[k]); });

      const recentOrders = Array.isArray(data?.recentOrders)
        ? data.recentOrders.map((o: any) => ({
            id: o.id,
            customer: o.customer || 'Guest',
            product: o.product,
            amount: num(o.amount),
            status: typeof o.status === 'string'
              ? o.status.charAt(0).toUpperCase() + o.status.slice(1)
              : 'Pending',
            date: o.date ? new Date(o.date).toLocaleDateString() : '-',
          }))
        : [];

      return {
        range: (data?.range as DashboardRange) || range,
        stats,
        recentOrders,
        revenueData: Array.isArray(data?.revenueData) ? data.revenueData : [],
        categoryData: Array.isArray(data?.categoryData) ? data.categoryData : [],
        topProducts: Array.isArray(data?.topProducts) ? data.topProducts : [],
      };
    },
  });
};
