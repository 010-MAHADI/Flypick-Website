import { Link } from "react-router-dom";

const SiteFooter = () => (
  <footer className="bg-muted border-t border-border mt-8 py-8">
    <div className="max-w-[1440px] mx-auto px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
        <div>
          <h4 className="font-bold text-sm mb-3 text-foreground">Customer Service</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/faq" className="hover:text-foreground">Help Center / FAQ</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact Us</Link></li>
            <li><Link to="/return-policy" className="hover:text-foreground">Return & Refund</Link></li>
            <li><Link to="/shipping-policy" className="hover:text-foreground">Shipping Info</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-3 text-foreground">About Flypick</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-foreground">About Us</Link></li>
            <li><Link to="/privacy-policy" className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link to="/terms-of-service" className="hover:text-foreground">Terms of Service</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-3 text-foreground">My Account</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/account" className="hover:text-foreground">My Profile</Link></li>
            <li><Link to="/orders" className="hover:text-foreground">My Orders</Link></li>
            <li><Link to="/wishlist" className="hover:text-foreground">Wishlist</Link></li>
            <li><Link to="/cart" className="hover:text-foreground">Shopping Cart</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-3 text-foreground">Pay with</h4>
          <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="bg-card px-2 py-1 rounded border border-border">Visa</span>
            <span className="bg-card px-2 py-1 rounded border border-border">Mastercard</span>
            <span className="bg-card px-2 py-1 rounded border border-border">bKash</span>
            <span className="bg-card px-2 py-1 rounded border border-border">Nagad</span>
          </div>
          <h4 className="font-bold text-sm mt-4 mb-2 text-foreground">Follow Us</h4>
          <div className="flex gap-3 text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer text-sm">Facebook</span>
            <span className="hover:text-foreground cursor-pointer text-sm">Instagram</span>
            <span className="hover:text-foreground cursor-pointer text-sm">YouTube</span>
          </div>
        </div>
      </div>
      <div className="text-center text-xs text-muted-foreground border-t border-border pt-4">
        © 2026 Flypick. All rights reserved. | 
        <Link to="/privacy-policy" className="hover:text-foreground ml-1">Privacy</Link> · 
        <Link to="/terms-of-service" className="hover:text-foreground ml-1">Terms</Link> · 
        <Link to="/contact" className="hover:text-foreground ml-1">Contact</Link>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
