import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";

export interface SellerTransaction {
  id: string;
  order: string;
  customer: string;
  amount: number;
  method: string;
  status: "Completed" | "Pending" | "Refunded";
  date: string;
}

export interface PaymentMethods {
  cash_on_delivery: boolean;
  bkash: boolean;
  nagad: boolean;
  credit_card: boolean;
}

export interface TransactionsResponse {
  summary: {
    totalRevenue: number;
    pending: number;
    refunded: number;
  };
  paymentMethods: PaymentMethods;
  transactions: SellerTransaction[];
}

const QUERY_KEY = ["seller_transactions"];

export const useTransactions = () =>
  useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<TransactionsResponse> => {
      const response = await api.get("/seller/transactions/");
      return response.data;
    },
  });

export const useUpdatePaymentMethods = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<PaymentMethods>) => {
      const response = await api.patch("/orders/payment-methods/toggle/", payload);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.refetchQueries({ queryKey: QUERY_KEY });
    },
  });
};
