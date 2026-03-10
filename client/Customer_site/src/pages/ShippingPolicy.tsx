import { Link } from "react-router-dom";
import { ChevronRight, Truck, Clock, Globe, Package } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const ShippingPolicy = () => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    <main className="max-w-3xl mx-auto px-4 py-6 pb-20 sm:pb-8">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Shipping Policy</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Shipping Policy</h1>

      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {[
          { icon: Truck, label: "Free Standard Shipping", desc: "On all orders over ৳500" },
          { icon: Clock, label: "7-15 Business Days", desc: "Standard delivery time" },
          { icon: Globe, label: "Nationwide Delivery", desc: "We ship across Bangladesh" },
          { icon: Package, label: "Order Tracking", desc: "Track every step of the way" },
        ].map((item) => (
          <div key={item.label} className="border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <item.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="prose-sm space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Shipping Methods & Costs</h2>
          <div className="border border-border rounded-lg overflow-hidden mt-3">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-foreground">Method</th>
                  <th className="text-left px-4 py-2.5 font-medium text-foreground">Delivery Time</th>
                  <th className="text-left px-4 py-2.5 font-medium text-foreground">Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-4 py-2.5">Standard Shipping</td>
                  <td className="px-4 py-2.5">7-15 business days</td>
                  <td className="px-4 py-2.5">Free (orders over ৳500)</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-2.5">Express Shipping</td>
                  <td className="px-4 py-2.5">3-5 business days</td>
                  <td className="px-4 py-2.5">৳150</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-2.5">Same-Day (Dhaka only)</td>
                  <td className="px-4 py-2.5">Within 24 hours</td>
                  <td className="px-4 py-2.5">৳300</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Order Processing</h2>
          <p>Orders are processed within 1-2 business days after payment confirmation. Orders placed on weekends or holidays will be processed on the next business day.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Tracking Your Order</h2>
          <p>Once your order has been shipped, you will receive a confirmation email with a tracking number. You can also track your order from the <strong className="text-foreground">My Orders</strong> section in your account.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Delivery Areas</h2>
          <p>We currently deliver to all districts across Bangladesh. Remote areas may require additional delivery time (up to 20 business days).</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Failed Delivery</h2>
          <p>If delivery is unsuccessful after two attempts, the package will be returned to our warehouse. You will be contacted to arrange redelivery, which may incur additional shipping charges.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Contact</h2>
          <p>For shipping inquiries, email <span className="text-primary">shipping@flypick.com</span> or visit our <Link to="/contact" className="text-primary hover:underline">Contact page</Link>.</p>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default ShippingPolicy;
