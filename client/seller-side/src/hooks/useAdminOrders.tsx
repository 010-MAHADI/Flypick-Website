import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";

export interface LedgerEntryLine {
  id: number;
  account_type: string;
  account_owner: string | null;
  debit: string;
  credit: string;
  balance_before: string;
  balance_after: string;
  created_at: string;
}

export interface LedgerTxn {
  transaction_id: string;
  reference: string | null;
  txn_type: string;
  status: string;
  order_id: string | null;
  refund_id: string | null;
  withdrawal_id: string | null;
  coupon_code: string | null;
  created_by_email: string | null;
  notes: string;
  created_at: string;
  entries: LedgerEntryLine[];
}

export interface AdminOrderItem {
  id: number;
  product_title: string;
  quantity: number;
  price: string;
  shipping_type?: string;
  shipping_charge?: string;
  shipping_estimated_delivery?: string;
}

export interface AdminOrder {
  id: number;
  order_id: string;
  customer_email: string;
  customer_name: string;
  shipping_full_name: string;
  shipping_phone: string;
  shipping_city: string;
  payment_method: string;
  payment_status: string;
  subtotal: string;
  shipping_cost: string;
  shipping_method?: string;
  shipping_estimated_delivery?: string;
  discount: string;
  store_credit_used: string;
  total_amount: string;
  status: string;
  tracking_number: string | null;
  courier_name: string | null;
  created_at: string;
  items: AdminOrderItem[];
  financial_history?: LedgerTxn[];
  refunds?: Array<{
    refund_id: string; amount: string; status: string; method: string;
    origin?: string; settlement_owner?: string; settlement_transaction_id?: string;
    settlement_proof_url?: string | null; reason?: string;
  }>;
  status_history?: TimelineEvent[];
  tracking_timeline?: TimelineEvent[];
  payment_timeline?: Array<{ event: string; txn_type: string; note: string; created_at: string }>;
  seller_activities?: TimelineEvent[];
  operation_logs?: Array<{ action: string; note: string; actor: string; created_at: string }>;
  shipping?: { method: string; estimated_delivery: string; courier_name: string | null; tracking_number: string | null };
  sellers?: Array<{ shop: string; seller_email: string; seller_name: string }>;
}

export interface TimelineEvent {
  from_status: string;
  to_status: string;
  note: string;
  actor: string;
  actor_role: string;
  created_at: string;
}

// Search an order by its Order ID (returns the order + full ledger history).
export const useAdminOrderSearch = () =>
  useMutation({
    mutationFn: async (orderId: string): Promise<AdminOrder> =>
      (await api.get("/orders/orders/admin_search/", { params: { order_id: orderId } })).data,
  });

// Admin payment correction (set payment_status / payment_method).
export const useAdminPaymentAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payment_status, payment_method, note }: {
      id: number;
      payment_status?: string;
      payment_method?: string;
      note?: string;
    }): Promise<AdminOrder> =>
      (await api.post(`/orders/orders/${id}/admin_payment_action/`, {
        payment_status, payment_method, note,
      })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_admin_summary"] });
    },
  });
};
