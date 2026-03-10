import { Link } from "react-router-dom";
import { ChevronRight, ShoppingBag, Users, Globe, Award, Heart, Zap } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const About = () => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    <main className="max-w-3xl mx-auto px-4 py-6 pb-20 sm:pb-8">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">About Us</span>
      </div>

      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-black mb-3">
          About <span className="text-primary">Fly</span>pick
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Your trusted online marketplace connecting millions of shoppers with quality products at unbeatable prices.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { num: "10M+", label: "Products", icon: ShoppingBag },
          { num: "5M+", label: "Happy Customers", icon: Users },
          { num: "50+", label: "Countries", icon: Globe },
          { num: "99%", label: "Satisfaction", icon: Award },
        ].map((stat) => (
          <div key={stat.label} className="border border-border rounded-xl p-4 text-center">
            <stat.icon className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-xl font-black text-foreground">{stat.num}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="prose-sm space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Our Story</h2>
          <p>Founded in 2024, Flypick started with a simple mission: make quality products accessible to everyone. What began as a small online store has grown into one of the region's most trusted e-commerce platforms, serving millions of customers across Bangladesh and beyond.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Our Mission</h2>
          <p>We believe everyone deserves access to quality products at fair prices. Our platform connects buyers directly with trusted sellers, cutting out unnecessary middlemen to bring you the best deals possible.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">What Sets Us Apart</h2>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {[
              { icon: Heart, title: "Customer First", desc: "24/7 support with a satisfaction guarantee on every purchase" },
              { icon: Zap, title: "Fast & Reliable", desc: "Quick delivery with real-time tracking on all orders" },
              { icon: Award, title: "Quality Assured", desc: "Rigorous seller verification and product quality checks" },
              { icon: Globe, title: "Wide Selection", desc: "Millions of products across hundreds of categories" },
            ].map((item) => (
              <div key={item.title} className="border border-border rounded-lg p-4">
                <item.icon className="w-5 h-5 text-primary mb-2" />
                <p className="font-bold text-sm text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">Join Us</h2>
          <p>Whether you're a shopper looking for great deals or a seller wanting to reach millions of customers, Flypick is the platform for you. <Link to="/contact" className="text-primary hover:underline">Get in touch</Link> to learn more.</p>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default About;
