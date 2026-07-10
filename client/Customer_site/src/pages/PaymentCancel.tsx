import { useSearchParams, Link } from "react-router-dom";
import { XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const PaymentCancel = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[600px] mx-auto px-4 py-20 text-center">
        <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-3">Payment Cancelled</h1>
        <p className="text-muted-foreground mb-2">
          Your payment was cancelled and no charge was made.
        </p>
        {orderId && (
          <p className="text-sm text-muted-foreground mb-6">
            Order <span className="font-medium text-foreground">{orderId}</span> has been cancelled.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <Link
            to="/checkout"
            className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-lg hover:opacity-90"
          >
            Try Again
          </Link>
          <Link
            to="/cart"
            className="border-2 border-foreground text-foreground font-bold px-8 py-3 rounded-lg hover:bg-muted"
          >
            Back to Cart
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default PaymentCancel;
