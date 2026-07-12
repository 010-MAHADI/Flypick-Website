import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";

export interface AdminRefund {
  id: number;
  refund_id: string;
  order_id: string;
  customer_name: string;
  amount: string;
  method: string;
  status: string;
  reason: string;
  origin: string;
  payment_method: string;
  settlement_owner: "none" | "seller" | "admin";
  settlement_transaction_id: string;
  settlement_proof_url: string | null;
  settled_by_email: string | null;
  settled_at: string | null;
  created_at: string;
}

interface Paginated<T> { count: number; results: T[]; }

function normalize(data: any): AdminRefund[] {
  const rows = data?.results ?? data;
  return Array.isArray(rows) ? rows : [];
}

// Refunds awaiting admin settlement (online original-method refunds).
export const useAdminRefundQueue = () =>
  useQuery({
    queryKey: ["admin_refund_queue"],
    queryFn: async (): Promise<AdminRefund[]> =>
      normalize((await api.get("/orders/refunds/", { params: { queue: "awaiting_settlement" } })).data),
  });

// All refunds (for the history/all tab).
export const useAllRefunds = (status?: string) =>
  useQuery({
    queryKey: ["admin_all_refunds", status ?? "all"],
    queryFn: async (): Promise<AdminRefund[]> =>
      normalize((await api.get("/orders/refunds/", { params: status ? { status } : {} })).data),
  });

export const useSettleRefundAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ refundId, transactionId, note, proof }: {
      refundId: number; transactionId: string; note?: string; proof?: File | null;
    }) => {
      const form = new FormData();
      form.append("transaction_id", transactionId);
      if (note) form.append("note", note);
      if (proof) form.append("proof", proof);
      return (await api.post(`/orders/refunds/${refundId}/settle/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_refund_queue"] });
      queryClient.invalidateQueries({ queryKey: ["admin_all_refunds"] });
      queryClient.invalidateQueries({ queryKey: ["finance_admin_summary"] });
    },
  });
};

export const useRejectRefundAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ refundId, note }: { refundId: number; note?: string }) =>
      (await api.post(`/orders/refunds/${refundId}/transition/`, { status: "rejected", note })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_refund_queue"] });
      queryClient.invalidateQueries({ queryKey: ["admin_all_refunds"] });
    },
  });
};
