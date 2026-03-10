import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Mail, Phone, MapPin, Clock, Send } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setSent(true);
    toast({ title: "Message sent!", description: "We'll get back to you within 24 hours." });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-20 sm:pb-8">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">Contact Us</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Contact Us</h1>

        {/* Contact info cards */}
        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          {[
            { icon: Mail, label: "Email", value: "support@flypick.com", desc: "We reply within 24 hours" },
            { icon: Phone, label: "Phone", value: "+880 1234-567890", desc: "Sat-Thu, 9AM - 8PM" },
            { icon: MapPin, label: "Office", value: "Dhaka, Bangladesh", desc: "Gulshan, Road 11" },
            { icon: Clock, label: "Business Hours", value: "Sat - Thu", desc: "9:00 AM - 8:00 PM BST" },
          ].map((item) => (
            <div key={item.label} className="border border-border rounded-xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm">{item.label}</p>
                <p className="text-sm text-foreground">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Contact form */}
        <div className="border border-border rounded-xl p-5 sm:p-6">
          <h2 className="text-lg font-bold mb-4">Send us a message</h2>

          {sent ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2">Thank you!</h3>
              <p className="text-sm text-muted-foreground mb-4">Your message has been sent. We'll get back to you within 24 hours.</p>
              <button onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }} className="text-sm text-primary hover:underline">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Full Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1">Subject</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="How can we help?" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1">Message *</Label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell us more..."
                  rows={5}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <button type="submit" className="bg-primary text-primary-foreground font-bold py-3 px-8 rounded-lg hover:opacity-90 transition-opacity text-sm w-full sm:w-auto">
                Send Message
              </button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Contact;
