import { useMemo, useState } from "react";
import { CheckCircle, MoreHorizontal, Search, Star, XCircle } from "lucide-react";
import { toast } from "sonner";

import { useReviewsAdmin, useUpdateReviewStatus, type ReviewStatus } from "@/hooks/useReviewsAdmin";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusClass: Record<string, string> = {
  Published: "status-badge status-badge--success",
  Pending: "status-badge status-badge--warning",
  Rejected: "status-badge status-badge--destructive",
};

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          className={`h-3.5 w-3.5 ${index <= count ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

const toUiStatus = (status: ReviewStatus) =>
  status === "published" ? "Published" : status === "pending" ? "Pending" : "Rejected";

export default function Reviews() {
  const { data: reviews = [], isLoading } = useReviewsAdmin();
  const updateStatus = useUpdateReviewStatus();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      reviews.filter(
        (review) =>
          review.product_name.toLowerCase().includes(search.toLowerCase()) ||
          review.customer_name.toLowerCase().includes(search.toLowerCase()) ||
          review.customer_email.toLowerCase().includes(search.toLowerCase())
      ),
    [reviews, search]
  );

  const averageRating = reviews.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const handleStatusUpdate = async (id: number, status: ReviewStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(`Review ${toUiStatus(status).toLowerCase()}`);
    } catch {
      toast.error("Failed to update review status");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1>Reviews</h1>
        <p>{reviews.length} reviews - Avg {averageRating} stars</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-primary">{averageRating}</p>
          <div className="flex justify-center mt-1">
            <Stars count={Math.round(Number(averageRating))} />
          </div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Average Rating</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-warning">
            {reviews.filter((review) => review.status === "pending").length}
          </p>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Pending Review</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-success">
            {reviews.filter((review) => review.rating >= 4).length}
          </p>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Positive (4-5)</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search reviews..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-10 rounded-lg"
        />
      </div>

      {isLoading ? (
        <div className="stat-card py-10 text-center text-muted-foreground">Loading reviews...</div>
      ) : (
        <div className="stat-card overflow-x-auto p-0">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="pl-5">Product</th>
                <th>Customer</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Status</th>
                <th>Date</th>
                <th className="w-10 pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((review) => {
                const uiStatus = toUiStatus(review.status);
                return (
                  <tr key={review.id}>
                    <td className="font-medium max-w-[180px] truncate pl-5">
                      {review.product_name || "Product"}
                    </td>
                    <td>
                      <div>
                        <p>{review.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{review.customer_email}</p>
                      </div>
                    </td>
                    <td>
                      <Stars count={review.rating} />
                    </td>
                    <td className="max-w-[240px] truncate text-muted-foreground">{review.comment}</td>
                    <td>
                      <span className={statusClass[uiStatus]}>{uiStatus}</span>
                    </td>
                    <td className="text-muted-foreground">
                      {new Date(review.created_at).toISOString().slice(0, 10)}
                    </td>
                    <td className="pr-5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStatusUpdate(review.id, "published")}>
                            <CheckCircle className="h-4 w-4 mr-2" /> Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleStatusUpdate(review.id, "rejected")}
                          >
                            <XCircle className="h-4 w-4 mr-2" /> Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="pl-5 py-8 text-muted-foreground" colSpan={7}>
                    No reviews found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
