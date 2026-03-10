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
}

export const useAnalytics = () =>
  useQuery({
    queryKey: ["seller_analytics"],
    queryFn: async (): Promise<SellerAnalytics> => {
      const response = await api.get("/seller/analytics/");
      return response.data;
    },
  });

