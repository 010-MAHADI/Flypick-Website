import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqSections = [
  {
    title: "Orders & Payments",
    items: [
      { q: "How do I place an order?", a: "Browse products, add items to your cart, proceed to checkout, enter your shipping address, select a payment method, and confirm your order. You'll receive an order confirmation via email." },
      { q: "What payment methods do you accept?", a: "We accept Cash on Delivery (COD), bKash, Nagad, and Credit/Debit cards (Visa, Mastercard). All online payments are processed securely." },
      { q: "Can I cancel my order?", a: "You can cancel your order before it's been shipped. Go to My Orders, find the order, and click 'Cancel Order'. Once shipped, you'll need to wait for delivery and initiate a return." },
      { q: "How do I track my order?", a: "Go to My Orders in your account to see real-time tracking updates. You'll also receive email/SMS notifications at each stage of delivery." },
    ],
  },
  {
    title: "Shipping & Delivery",
    items: [
      { q: "How long does delivery take?", a: "Standard shipping takes 7-15 business days. Express shipping delivers in 3-5 business days. Same-day delivery is available in Dhaka for orders placed before 12 PM." },
      { q: "Do you offer free shipping?", a: "Yes! Standard shipping is free on all orders over ৳500. Orders below ৳500 have a flat shipping fee of ৳60." },
      { q: "Do you ship internationally?", a: "Currently, we only ship within Bangladesh. We're working on expanding our delivery network to serve international customers soon." },
      { q: "What if my package is lost or damaged?", a: "Contact our support team within 48 hours of the expected delivery date. We'll investigate and provide a full refund or replacement." },
    ],
  },
  {
    title: "Returns & Refunds",
    items: [
      { q: "What is your return policy?", a: "Most items can be returned within 15 days of delivery. Items must be unused, in original packaging, with all tags intact. See our Return Policy page for full details." },
      { q: "How do I return an item?", a: "Go to My Orders, select the item, click 'Request Return', choose a reason, and follow the instructions to ship it back. Free return shipping is available on eligible items." },
      { q: "When will I get my refund?", a: "Refunds are processed within 3-5 business days after we receive and inspect your returned item. The refund goes back to your original payment method." },
      { q: "Can I exchange an item?", a: "We don't offer direct exchanges. Please return the original item and place a new order for the desired product." },
    ],
  },
  {
    title: "Account & Security",
    items: [
      { q: "How do I create an account?", a: "Click 'Sign in / Register' at the top of the page, then select 'Sign up'. You can register with your email or sign in with Google/Apple." },
      { q: "I forgot my password. How do I reset it?", a: "Click 'Forgot password?' on the login page, enter your email, and we'll send you a reset link. Check your spam folder if you don't see it." },
      { q: "Is my personal information secure?", a: "Yes. We use industry-standard encryption and security measures to protect your data. We never sell your personal information to third parties." },
      { q: "How do I delete my account?", a: "Contact our support team at support@flypick.com to request account deletion. We'll process your request within 7 business days." },
    ],
  },
];

const FAQ = () => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    <main className="max-w-3xl mx-auto px-4 py-6 pb-20 sm:pb-8">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Help Center / FAQ</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Help Center</h1>
      <p className="text-muted-foreground text-sm mb-8">Find answers to frequently asked questions below.</p>

      <div className="space-y-6">
        {faqSections.map((section) => (
          <div key={section.title}>
            <h2 className="text-lg font-bold mb-3">{section.title}</h2>
            <Accordion type="single" collapsible className="border border-border rounded-xl overflow-hidden">
              {section.items.map((item, i) => (
                <AccordionItem key={i} value={`${section.title}-${i}`} className="border-b border-border last:border-0">
                  <AccordionTrigger className="px-4 py-3 text-sm font-medium text-left hover:no-underline hover:bg-muted/50">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 text-sm text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </div>

      <div className="mt-10 border border-border rounded-xl p-6 text-center">
        <h3 className="font-bold mb-2">Still have questions?</h3>
        <p className="text-sm text-muted-foreground mb-4">Our support team is here to help you.</p>
        <Link to="/contact" className="bg-primary text-primary-foreground font-medium px-6 py-2.5 rounded-lg hover:opacity-90 text-sm inline-block">
          Contact Us
        </Link>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default FAQ;
