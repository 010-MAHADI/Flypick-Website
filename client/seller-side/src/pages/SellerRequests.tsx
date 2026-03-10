import { useMemo, useState } from "react";
import { Check, Filter, Search, Store, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";

type SellerRequestStatus = "pending" | "approved" | "rejected";

interface SellerRequest {
  id: number;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  business_name: string;
  business_category: string;
  business_description: string;
  additional_info?: string;
  status: "pending" | "active" | "rejected" | "suspended";
  date_joined: string;
}

const statusConfig: Record<SellerRequestStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  approved: { label: "Approved", className: "bg-green-500/10 text-green-700 dark:text-green-400" },
  rejected: { label: "Rejected", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

const mapStatus = (raw: SellerRequest["status"]): SellerRequestStatus => {
  if (raw === "active") return "approved";
  if (raw === "rejected") return "rejected";
  return "pending";
};

export default function SellerRequests() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SellerRequestStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["seller_requests"],
    queryFn: async (): Promise<SellerRequest[]> => {
      const response = await api.get("/users/seller-requests/");
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ sellerId, action }: { sellerId: number; action: "approve" | "reject" }) => {
      await api.patch(`/users/seller-requests/${sellerId}/review/`, { action });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["seller_requests"] });
      toast.success(vars.action === "approve" ? "Seller request approved" : "Seller request rejected");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to update request");
    },
  });

  const filtered = useMemo(() => {
    return requests.filter((request) => {
      const normalizedStatus = mapStatus(request.status);
      const q = search.toLowerCase();
      const matchSearch =
        request.owner_name?.toLowerCase().includes(q) ||
        request.business_name?.toLowerCase().includes(q) ||
        request.email?.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || normalizedStatus === statusFilter;
      const matchCategory =
        categoryFilter === "all" || (request.business_category || "").toLowerCase() === categoryFilter.toLowerCase();
      return matchSearch && matchStatus && matchCategory;
    });
  }, [requests, search, statusFilter, categoryFilter]);

  const categories = Array.from(
    new Set(
      requests
        .map((request) => request.business_category)
        .filter((value): value is string => Boolean(value))
    )
  );

  const stats = requests.reduce(
    (acc, request) => {
      const status = mapStatus(request.status);
      acc[status] += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 }
  );

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading seller requests...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header !mb-0">
        <h1>Seller Requests</h1>
        <p>{requests.length} total requests</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground font-medium">Pending</p>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground font-medium">Approved</p>
          <p className="text-2xl font-bold mt-1">{stats.approved}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground font-medium">Rejected</p>
          <p className="text-2xl font-bold mt-1">{stats.rejected}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search owner, business, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-lg"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as SellerRequestStatus | "all")}>
          <SelectTrigger className="w-[160px] rounded-lg">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] rounded-lg">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="stat-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-4 text-sm font-semibold">Business</th>
                <th className="text-left p-4 text-sm font-semibold">Owner</th>
                <th className="text-left p-4 text-sm font-semibold">Category</th>
                <th className="text-left p-4 text-sm font-semibold">Request Date</th>
                <th className="text-left p-4 text-sm font-semibold">Status</th>
                <th className="text-right p-4 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((request) => {
                const normalizedStatus = mapStatus(request.status);
                return (
                  <tr key={request.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-semibold text-sm">{request.business_name || "Business"}</p>
                        <p className="text-xs text-muted-foreground">{request.email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm">{request.owner_name}</p>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="font-medium">
                        {request.business_category || "General"}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <p className="text-sm">{new Date(request.date_joined).toLocaleDateString()}</p>
                    </td>
                    <td className="p-4">
                      <Badge className={statusConfig[normalizedStatus].className}>
                        {statusConfig[normalizedStatus].label}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {normalizedStatus === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 bg-green-600 hover:bg-green-700"
                              disabled={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ sellerId: request.id, action: "approve" })}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8"
                              disabled={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ sellerId: request.id, action: "reject" })}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Reviewed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Store className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No seller requests found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
