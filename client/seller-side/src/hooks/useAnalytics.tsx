import { useQuery } from "@tanstack/react-query";

import api from "@/lib/api";

export interface AnalyticsStat {
  label: string;
  value: string;
  change: string;
}

export interface WeeklyTrafficPoint {
  day: string;
  visitors: number;
  pageViews: number;
}

export interface ConversionTrendPoint {
  month: string;
  rate: number;
}

export interface TopPage {
  page: string;
  views: number;
  bounceRate: string;
}

export interface PlatformGrowthPoint {
  month: string;
  revenue: number;
  orders: number;
  newCustomers: number;
  newSellers: number;
  newProducts: number;
}

export interface PlatformInsights {
  growth: PlatformGrowthPoint[];
  categoryPerformance: { name: string; revenue: number; sold: number }[];
  topSellers: { id: number; name: string; shop: string; revenue: number; orders: number }[];
  topProducts: { id: number; name: string; revenue: number; sold: number }[];
  refunds: {
    total: number;
    pending: number;
    completed: number;
    rejected: number;
    returnRequests: number;
    refundRate: number;
  };
  totals: {
    customers: number;
    sellers: number;
    products: number;
    orders: number;
  };
}

export interface SellerAnalytics {
  stats: AnalyticsStat[];
  weeklyTraffic: WeeklyTrafficPoint[];
  conversionTrend: ConversionTrendPoint[];
  topPages: TopPage[];
  meta: {
    revenue: number;
    orders: number;
    products: number;
    customers: number;
  };
  platform?: PlatformInsights;
}

export const useAnalytics = () =>
  useQuery({
    queryKey: ["seller_analytics"],
    queryFn: async (): Promise<SellerAnalytics> => {
      const response = await api.get("/seller/analytics/");
      return response.data;
    },
  });

