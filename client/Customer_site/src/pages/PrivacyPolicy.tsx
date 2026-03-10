import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    <main className="max-w-3xl mx-auto px-4 py-6 pb-20 sm:pb-8">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Privacy Policy</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: March 8, 2026</p>

      <div className="prose-sm space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">1. Information We Collect</h2>
          <p>We collect information you provide directly, such as your name, email address, phone number, shipping address, and payment details when you create an account, make a purchase, or contact us.</p>
          <p className="mt-2">We also automatically collect certain information when you visit our platform, including your IP address, browser type, device information, pages viewed, and referring URLs.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Process and fulfill your orders</li>
            <li>Send order confirmations, shipping updates, and receipts</li>
            <li>Provide customer support and respond to inquiries</li>
            <li>Personalize your shopping experience and recommend products</li>
            <li>Send promotional communications (with your consent)</li>
            <li>Detect and prevent fraud or unauthorized activity</li>
            <li>Improve our platform, services, and user experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">3. Information Sharing</h2>
          <p>We do not sell your personal information. We may share your data with:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Shipping and logistics partners to deliver your orders</li>
            <li>Payment processors to complete transactions securely</li>
            <li>Service providers who assist in operating our platform</li>
            <li>Law enforcement when required by applicable law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">4. Cookies & Tracking</h2>
          <p>We use cookies and similar technologies to remember your preferences, keep you logged in, analyze traffic, and deliver relevant advertisements. You can manage cookie preferences through your browser settings.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">5. Data Security</h2>
          <p>We implement industry-standard security measures including encryption, secure servers, and access controls to protect your personal information. However, no method of transmission over the internet is 100% secure.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">6. Your Rights</h2>
          <p>You have the right to access, update, correct, or delete your personal information. You may also opt out of marketing communications at any time. To exercise these rights, contact us at privacy@flypick.com.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">7. Children's Privacy</h2>
          <p>Our platform is not intended for children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us immediately.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">8. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on our platform or sending you an email.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">9. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at <span className="text-primary">privacy@flypick.com</span> or visit our <Link to="/contact" className="text-primary hover:underline">Contact page</Link>.</p>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default PrivacyPolicy;
