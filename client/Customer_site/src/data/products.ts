export interface Product {
  id: number;
  title: string;
  price: number;
  originalPrice: number;
  discount: number;
  rating: number;
  reviews: number;
  sold: string;
  image: string;
  image_gallery?: string[];
  video_gallery?: string[];
  badges: string[];
  freeShipping: boolean;
  welcomeDeal: boolean;
  store: string;
}

export const categories = [
  "SuperDeals", "Flypick Business", "Home & Garden", "Home Appliances",
  "Furniture", "Home Improvement & Lighting", "Lingerie & Loungewear",
  "Electronics", "Phones & Accessories", "Computer & Office", "Sports & Outdoors"
];

export const products: Product[] = [
  {
    id: 1, title: "46Pcs Family Tools 1/4 Set Socket Wrench Mechanic Tool Kit",
    price: 946.28, originalPrice: 1892.56, discount: 50, rating: 4.4, reviews: 476,
    sold: "10,000+", image: "https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: false, welcomeDeal: false, store: "ToolMaster Store"
  },
  {
    id: 2, title: "60W 80W Electric Soldering Iron Kit Adjustable Temperature",
    price: 948.84, originalPrice: 1221.50, discount: 22, rating: 4.6, reviews: 328,
    sold: "10,000+", image: "https://images.unsplash.com/photo-1588783323287-4c0bcd3f0bc6?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: true, welcomeDeal: true, store: "ElectroParts Official"
  },
  {
    id: 3, title: "4 Ports USB C PD Charger 120W Fast Charging Station",
    price: 390.05, originalPrice: 923.25, discount: 58, rating: 4.1, reviews: 892,
    sold: "100K+", image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: true, welcomeDeal: true, store: "TechCharge Store"
  },
  {
    id: 4, title: "Smart Stainless Steel Multifunctional Kitchen Scissors",
    price: 44.02, originalPrice: 79.54, discount: 45, rating: 4.3, reviews: 156,
    sold: "5,000+", image: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=300&h=300&fit=crop",
    badges: ["Sale"], freeShipping: false, welcomeDeal: false, store: "KitchenPro Store"
  },
  {
    id: 5, title: "Original Logitech G304 Lightspeed Wireless Gaming Mouse",
    price: 1397.36, originalPrice: 1714.84, discount: 18, rating: 4.4, reviews: 1205,
    sold: "10,000+", image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: true, welcomeDeal: true, store: "GameGear Official"
  },
  {
    id: 6, title: "Lenovo SD Memory Card High Speed Read/Write 2TB Storage",
    price: 363.06, originalPrice: 487.64, discount: 25, rating: 4.4, reviews: 763,
    sold: "10,000+", image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: true, welcomeDeal: true, store: "Digital Storage Hub"
  },
  {
    id: 7, title: "Wireless Bluetooth Earphones Neckband Sport Headset 12D",
    price: 143.70, originalPrice: 531.94, discount: 72, rating: 4.2, reviews: 421,
    sold: "5,000+", image: "https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=300&h=300&fit=crop",
    badges: ["Welcome Deal"], freeShipping: true, welcomeDeal: true, store: "SoundWave Store"
  },
  {
    id: 8, title: "2025 2000X25 8000m HD Monocular Telescope Night Vision",
    price: 561.23, originalPrice: 1122.46, discount: 50, rating: 4.1, reviews: 289,
    sold: "100K+", image: "https://images.unsplash.com/photo-1567427018369-e1df92ad3290?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: false, welcomeDeal: false, store: "OpticView Store"
  },
  {
    id: 9, title: "67W USB Fast Charger for Xiaomi Samsung iPhone Quick Charge",
    price: 611.55, originalPrice: 1712.17, discount: 64, rating: 3.9, reviews: 567,
    sold: "10,000+", image: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: true, welcomeDeal: true, store: "FastCharge Official"
  },
  {
    id: 10, title: "T9 Electric Hair Trimmer Professional Clipper Machine",
    price: 316.68, originalPrice: 633.36, discount: 50, rating: 4.2, reviews: 934,
    sold: "5,000+", image: "https://images.unsplash.com/photo-1622287162716-f311baa69e57?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: false, welcomeDeal: false, store: "GroomPro Store"
  },
  {
    id: 11, title: "RGB LED Strip Light 5050 USB Flexible Tape Color Changing",
    price: 121.05, originalPrice: 432.84, discount: 72, rating: 4.4, reviews: 1567,
    sold: "5,000+", image: "https://images.unsplash.com/photo-1615750185825-fc85b1a4d4c2?w=300&h=300&fit=crop",
    badges: ["Choice", "SuperDeals"], freeShipping: false, welcomeDeal: false, store: "LightUp Store"
  },
  {
    id: 12, title: "25-in-1 Mini Screwdriver Set Precision Repair Tool Kit",
    price: 634.85, originalPrice: 1758.78, discount: 63, rating: 4.2, reviews: 445,
    sold: "1,000+", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: true, welcomeDeal: true, store: "FixIt Tools Store"
  },
  {
    id: 13, title: "ESP32 Development Board TYPE-C WiFi+Bluetooth Dual Core",
    price: 409.61, originalPrice: 654.15, discount: 37, rating: 4.7, reviews: 476,
    sold: "10,000+", image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&h=300&fit=crop",
    badges: ["Choice"], freeShipping: true, welcomeDeal: true, store: "Simple Robot Store"
  },
  {
    id: 14, title: "Portable Bluetooth Speaker Waterproof Outdoor Wireless",
    price: 825.50, originalPrice: 1651.00, discount: 50, rating: 4.5, reviews: 2341,
    sold: "50,000+", image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: true, welcomeDeal: false, store: "SpeakerWorld"
  },
  {
    id: 15, title: "Smart Watch Fitness Tracker Heart Rate Blood Pressure",
    price: 1245.30, originalPrice: 2490.60, discount: 50, rating: 4.3, reviews: 3567,
    sold: "20,000+", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop",
    badges: ["Choice", "SuperDeals"], freeShipping: true, welcomeDeal: true, store: "WearTech Official"
  },
  {
    id: 16, title: "Mechanical Gaming Keyboard RGB Backlit 104 Keys Wired",
    price: 1876.45, originalPrice: 3752.90, discount: 50, rating: 4.6, reviews: 892,
    sold: "8,000+", image: "https://images.unsplash.com/photo-1595225476474-87563907a212?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: true, welcomeDeal: true, store: "KeyMaster Store"
  },
  {
    id: 17, title: "Mini Projector 4K HD Portable Home Theater WiFi Bluetooth",
    price: 5632.10, originalPrice: 11264.20, discount: 50, rating: 4.1, reviews: 678,
    sold: "3,000+", image: "https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=300&h=300&fit=crop",
    badges: ["Sale"], freeShipping: true, welcomeDeal: false, store: "ProjectorHub"
  },
  {
    id: 18, title: "Drone 4K Camera Professional Aerial Photography Quadcopter",
    price: 4521.80, originalPrice: 9043.60, discount: 50, rating: 4.4, reviews: 1234,
    sold: "15,000+", image: "https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=300&h=300&fit=crop",
    badges: ["Choice", "Sale"], freeShipping: true, welcomeDeal: true, store: "SkyTech Drones"
  },
];

export const bundleDeals = products.slice(0, 3);
export const superDeals = products.slice(3, 6);
export const topDeals = products.slice(6, 8);
