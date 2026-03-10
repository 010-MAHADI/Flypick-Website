import { Link } from "react-router-dom";
import { ChevronRight, RotateCcw, Clock, Package, ShieldCheck } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const ReturnPolicy = () => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    <main className="max-w-3xl mx-auto px-4 py-6 pb-20 sm:pb-8">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Return & Refund Policy</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Return & Refund Policy</h1>

      {/* Quick highlights */}
      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {[
          { icon: Clock, label: "15-Day Returns", desc: "From date of delivery" },
          { icon: RotateCcw, label: "Free Returns", desc: "On eligible items" },
          { icon: ShieldCheck, label: "Buyer Protection", desc: "Full refund guarantee" },
        ].map((item) => (
          <div key={item.label} className="border border-border rounded-xl p-4 text-center">
            <item.icon className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="font-bold text-sm">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="prose-sm space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Return Eligibility</h2>
          <p>You may return most items within 15 days of delivery for a full refund. To be eligible:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Items must be unused and in original packaging</li>
            <li>All tags and labels must be intact</li>
            <li>You must provide proof of purchase (order number or receipt)</li>
            <li>Items must not be from the non-returnable category</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Non-Returnable Items</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Intimate apparel, swimwear, and undergarments</li>
            <li>Personalized or customized products</li>
            <li>Perishable goods (food, flowers, etc.)</li>
            <li>Digital downloads and gift cards</li>
            <li>Health and hygiene products (opened)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">How to Initiate a Return</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Go to <strong className="text-foreground">My Orders</strong> in your account</li>
            <li>Select the order containing the item you want to return</li>
            <li>Click <strong className="text-foreground">"Request Return"</strong> and choose a reason</li>
            <li>Pack the item securely and attach the return label</li>
            <li>Drop off the package at any authorized shipping point</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Refund Process</h2>
          <p>Once we receive and inspect your returned item:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong className="text-foreground">Approved refunds</strong> — processed within 3-5 business days</li>
            <li><strong className="text-foreground">Original payment method</strong> — refund is returned to the same method used for purchase</li>
            <li><strong className="text-foreground">Cash on Delivery</strong> — refund via bank transfer or store credit</li>
            <li><strong className="text-foreground">Partial refunds</strong> — may apply if the item shows signs of use</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Exchanges</h2>
          <p>We currently do not offer direct exchanges. To get a different size, color, or item, please return the original and place a new order.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Damaged or Defective Items</h2>
          <p>If you receive a damaged or defective item, contact us within 48 hours of delivery with photos of the issue. We'll arrange a free return and full refund or replacement.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Contact</h2>
          <p>For return questions, email <span className="text-primary">returns@flypick.com</span> or visit our <Link to="/contact" className="text-primary hover:underline">Contact page</Link>.</p>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default ReturnPolicy;
