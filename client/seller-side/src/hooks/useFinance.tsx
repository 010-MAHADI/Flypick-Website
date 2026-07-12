import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";

// ---------------------------------------------------------------- types

export interface SellerLedgerEntry {
  id: number;
  account_type: string;
  txn_type: string;
  order_id: string | null;
  withdrawal_id: string | null;
  debit: string;
  credit: string;
  balance_after: string;
  notes: string;
  created_at: string;
}

export interface SellerWallet {
  marketplace_balance: string;
  locked_balance: string;
  paid_out_balance: string;
  negative_limit: string;
  entries: SellerLedgerEntry[];
}

export interface WithdrawalRequest {
  id: number;
  request_id: string;
  seller_email: string;
  seller_name: string;
  shop_name: string | null;
  amount: string;
  payout_method: string;
  payout_details: string;
  seller_note: string;
  status: "requested" | "approved" | "rejected";
  payment_transaction_id: string;
  payment_method: string;
  payment_proof_url: string | null;
  admin_note: string;
  processed_at: string | null;
  created_at: string;
}

export interface AdminFinanceSummary {
  seller_payable: string;
  seller_marketplace_total: string;
  seller_locked_total: string;
  seller_paid_out_total: string;
  platform_balance: string;
  coupon_reserve_total: string;
  customer_wallet_total: string;
  wallet_holds_total: string;
  escrow_cumulative_in: string;
  pending_withdrawals: number;
}

export interface AdminCoupon {
  id: number;
  code: string;
  name: string;
  scope: "marketplace" | "category" | "seller" | "product";
  category_ids: number[];
  seller_ids: number[];
  product_ids: number[];
  discount_type: "percent" | "fixed";
  discount_value: string;
  max_discount_amount: string | null;
  min_order_amount: string;
  budget: string;
  max_uses: number;
  uses: number;
  status: "draft" | "active" | "paused" | "expired" | "disabled";
  starts_at: string | null;
  expires_at: string;
  reserve_remaining: string;
  redeemed_total: string;
  created_at: string;
}

export interface SettlementRow {
  seller_id: number;
  seller_email: string;
  seller_name: string;
  marketplace_balance: string;
  locked_balance: string;
  paid_out_balance: string;
  pending_withdrawals: string;
}

interface Paginated<T> {
  count: number;
  results: T[];
}

// --------------------------------------------------------------- seller

export const useSellerWallet = () =>
  useQuery({
    queryKey: ["seller_wallet"],
    queryFn: async (): Promise<SellerWallet> =>
      (await api.get("/finance/seller/wallet/")).data,
  });

export const useSellerWithdrawals = () =>
  useQuery({
    queryKey: ["seller_withdrawals"],
    queryFn: async (): Promise<Paginated<WithdrawalRequest>> =>
      (await api.get("/finance/seller/withdrawals/")).data,
  });

export const useCreateWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { amount: string; payout_method?: string; payout_details?: string; note?: string }) =>
      (await api.post("/finance/seller/withdrawals/", payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller_wallet"] });
      queryClient.invalidateQueries({ queryKey: ["seller_withdrawals"] });
    },
  });
};

// ---------------------------------------------------------------- admin

export const useAdminFinanceSummary = (enabled = true) =>
  useQuery({
    queryKey: ["finance_admin_summary"],
    queryFn: async (): Promise<AdminFinanceSummary> =>
      (await api.get("/finance/admin/summary/")).data,
    enabled,
  });

export interface AccountHistoryEntry {
  id: number;
  transaction_id: string;
  txn_type: string;
  txn_type_display: string;
  account_type: string;
  account_owner: string | null;
  order_id: string | null;
  product: string | null;
  customer_email: string | null;
  seller_email: string | null;
  amount: string;
  direction: "debit" | "credit";
  balance_before: string;
  balance_after: string;
  notes: string;
  created_at: string;
}

// Clickable balance-card history (seller_payable / platform_balance /
// coupon_reserve / customer_wallet). `category` null = query disabled.
export const useAccountHistory = (category: string | null) =>
  useQuery({
    queryKey: ["finance_account_history", category],
    enabled: !!category,
    queryFn: async (): Promise<Paginated<AccountHistoryEntry>> =>
      (await api.get(`/finance/admin/history/${category}/`)).data,
  });

export const useAdminWithdrawals = (status?: string) =>
  useQuery({
    queryKey: ["finance_admin_withdrawals", status ?? "all"],
    queryFn: async (): Promise<Paginated<WithdrawalRequest>> =>
      (await api.get("/finance/admin/withdrawals/", { params: status ? { status } : {} })).data,
  });

export const useApproveWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payment_transaction_id, payment_method, admin_note, payment_proof }: {
      id: number;
      payment_transaction_id: string;
      payment_method: string;
      admin_note?: string;
      payment_proof?: File | null;
    }) => {
      const form = new FormData();
      form.append("payment_transaction_id", payment_transaction_id);
      form.append("payment_method", payment_method);
      if (admin_note) form.append("admin_note", admin_note);
      if (payment_proof) form.append("payment_proof", payment_proof);
      return (await api.post(`/finance/admin/withdrawals/${id}/approve/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_admin_withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["finance_admin_summary"] });
    },
  });
};

export const useRejectWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, admin_note }: { id: number; admin_note?: string }) =>
      (await api.post(`/finance/admin/withdrawals/${id}/reject/`, { admin_note })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_admin_withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["finance_admin_summary"] });
    },
  });
};

export const useAdminDeposit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { amount: string; note?: string }) =>
      (await api.post("/finance/admin/deposit/", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance_admin_summary"] }),
  });
};

export const useSettlementReport = () =>
  useQuery({
    queryKey: ["finance_settlement_report"],
    queryFn: async (): Promise<{ sellers: SettlementRow[] }> =>
      (await api.get("/finance/admin/settlement-report/")).data,
  });

// ----------------------------------------------------------- admin coupons

export const useAdminCoupons = () =>
  useQuery({
    queryKey: ["finance_admin_coupons"],
    queryFn: async (): Promise<Paginated<AdminCoupon>> =>
      (await api.get("/finance/admin/coupons/")).data,
  });

export const useSaveAdminCoupon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<AdminCoupon> & { id?: number }) =>
      id
        ? (await api.patch(`/finance/admin/coupons/${id}/`, payload)).data
        : (await api.post("/finance/admin/coupons/", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance_admin_coupons"] }),
  });
};

export const useAdminCouponAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "activate" | "pause" | "expire" | "disable" }) =>
      (await api.post(`/finance/admin/coupons/${id}/${action}/`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_admin_coupons"] });
      queryClient.invalidateQueries({ queryKey: ["finance_admin_summary"] });
    },
  });
};
