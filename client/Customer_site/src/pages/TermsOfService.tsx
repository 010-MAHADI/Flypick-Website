import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const TermsOfService = () => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    <main className="max-w-3xl mx-auto px-4 py-6 pb-20 sm:pb-8">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Terms of Service</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: March 8, 2026</p>

      <div className="prose-sm space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">1. Acceptance of Terms</h2>
          <p>By accessing and using Flypick, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">2. Account Registration</h2>
          <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">3. Orders & Payments</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>All prices are listed in BDT (৳) unless otherwise stated</li>
            <li>Prices are subject to change without prior notice</li>
            <li>We reserve the right to cancel any order due to pricing errors</li>
            <li>Payment must be completed using one of our accepted payment methods</li>
            <li>Orders are confirmed only after successful payment processing</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">4. Product Information</h2>
          <p>We make every effort to display product images and descriptions accurately. However, we do not guarantee that colors, dimensions, or other details are perfectly accurate due to variations in monitors and photography.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">5. Shipping & Delivery</h2>
          <p>Delivery times are estimates and not guaranteed. We are not responsible for delays caused by shipping carriers, customs, or circumstances beyond our control. Please refer to our <Link to="/shipping-policy" className="text-primary hover:underline">Shipping Policy</Link> for details.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">6. Prohibited Activities</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Using the platform for any unlawful purpose</li>
            <li>Interfering with or disrupting platform security</li>
            <li>Creating multiple accounts to abuse promotions</li>
            <li>Reselling products purchased through promotional offers</li>
            <li>Posting false reviews or misleading content</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">7. Intellectual Property</h2>
          <p>All content on Flypick, including logos, text, images, and software, is owned by or licensed to us and is protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without our written consent.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">8. Limitation of Liability</h2>
          <p>Flypick shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our platform or products purchased through it.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">9. Termination</h2>
          <p>We reserve the right to suspend or terminate your account at any time for violation of these terms or any suspicious activity, without prior notice.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">10. Contact</h2>
          <p>For questions about these terms, contact us at <span className="text-primary">legal@flypick.com</span>.</p>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default TermsOfService;
