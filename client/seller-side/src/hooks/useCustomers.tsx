import { useQuery } from "@tanstack/react-query";

import api from "@/lib/api";

export interface SellerCustomer {
  id: number;
  name: string;
  email: string;
  orders: number;
  spent: number;
  joined: string | null;
  status: "Active" | "Blocked";
}

export const useCustomers = () =>
  useQuery({
    queryKey: ["seller_customers"],
    queryFn: async (): Promise<SellerCustomer[]> => {
      const response = await api.get("/seller/customers/");
      return Array.isArray(response.data) ? response.data : [];
    },
  });

