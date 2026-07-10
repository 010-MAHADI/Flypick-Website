import { Link } from "react-router-dom";
import { Facebook, Instagram, Youtube } from "lucide-react";

const LINK_GROUPS = [
  {
    title: "Customer Service",
    links: [
      { to: "/faq", label: "Help Center / FAQ" },
      { to: "/contact", label: "Contact Us" },
      { to: "/return-policy", label: "Return & Refund" },
      { to: "/shipping-policy", label: "Shipping Info" },
      { to: "/track-order", label: "Track Order" },
    ],
  },
  {
    title: "About Flypick",
    links: [
      { to: "/about", label: "About Us" },
      { to: "/privacy-policy", label: "Privacy Policy" },
      { to: "/terms-of-service", label: "Terms of Service" },
    ],
  },
  {
    title: "My Account",
    links: [
      { to: "/account", label: "My Profile" },
      { to: "/orders", label: "My Orders" },
      { to: "/wishlist", label: "Wishlist" },
      { to: "/cart", label: "Shopping Cart" },
    ],
  },
];

const SiteFooter = () => (
  <footer className="bg-card border-t border-border/70 mt-6 pb-20 md:pb-0">
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-7">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <span className="text-xl font-black tracking-tight text-primary">
            Fly<span className="text-foreground">pick</span>
          </span>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-[220px]">
            Your trusted online marketplace in Bangladesh — tech, gadgets and everyday essentials.
          </p>
          <div className="flex gap-2 mt-4">
            {[Facebook, Instagram, Youtube].map((Icon, i) => (
              <span
                key={i}
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
              >
                <Icon className="w-4 h-4" />
              </span>
            ))}
          </div>
        </div>

        {LINK_GROUPS.map((group) => (
          <div key={group.title}>
            <h4 className="font-bold text-[13px] mb-3 text-foreground">{group.title}</h4>
            <ul className="space-y-2 text-[13px] text-muted-foreground">
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="col-span-2 md:col-span-1">
          <h4 className="font-bold text-[13px] mb-3 text-foreground">Pay With</h4>
          <div className="flex gap-1.5 flex-wrap text-[11px] font-semibold text-foreground/70">
            {["bKash", "Nagad", "Visa", "Mastercard", "COD"].map((method) => (
              <span key={method} className="bg-muted px-2.5 py-1.5 rounded-lg">
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground border-t border-border/70 mt-8 pt-5">
        <p>© 2026 Flypick. All rights reserved.</p>
        <p className="flex gap-3">
          <Link to="/privacy-policy" className="hover:text-primary">Privacy</Link>
          <Link to="/terms-of-service" className="hover:text-primary">Terms</Link>
          <Link to="/contact" className="hover:text-primary">Contact</Link>
        </p>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
