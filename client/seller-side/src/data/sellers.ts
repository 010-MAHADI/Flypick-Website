export interface Shop {
  id: string;
  name: string;
  category: string;
  products: number;
  orders: number;
  revenue: string;
  rating: number;
  status: "active" | "inactive";
  description: string;
  commission: number;
  createdDate: string;
}

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  joinDate: string;
  location: string;
  address: string;
  status: "active" | "suspended" | "pending" | "rejected";
  totalRevenue: string;
  totalOrders: number;
  verified: boolean;
  idDocument: string;
  bankAccount: string;
  shops: Shop[];
  notes: { date: string; text: string }[];
}

export const sellers: Seller[] = [
  {
    id: "SLR-001",
    name: "Ahmed Hassan",
    email: "ahmed@techzone.com",
    phone: "+1 234 567 890",
    avatar: "AH",
    joinDate: "2024-03-15",
    location: "New York, USA",
    address: "123 Broadway, Suite 400, New York, NY 10001",
    status: "active",
    totalRevenue: "$124,500",
    totalOrders: 1842,
    verified: true,
    idDocument: "Verified - National ID",
    bankAccount: "****4521 - Chase Bank",
    shops: [
      { id: "SHP-001", name: "TechZone Electronics", category: "Electronics", products: 156, orders: 1200, revenue: "$89,000", rating: 4.8, status: "active", description: "Premium electronics and accessories store", commission: 12, createdDate: "2024-03-15" },
      { id: "SHP-002", name: "GadgetHub", category: "Gadgets", products: 78, orders: 642, revenue: "$35,500", rating: 4.5, status: "active", description: "Trending gadgets and tech toys", commission: 10, createdDate: "2024-05-20" },
    ],
    notes: [
      { date: "2025-01-10", text: "Seller verified after document review" },
      { date: "2025-02-15", text: "Commission rate adjusted to 12% for electronics" },
    ],
  },
  {
    id: "SLR-002",
    name: "Sarah Williams",
    email: "sarah@fashionista.com",
    phone: "+1 345 678 901",
    avatar: "SW",
    joinDate: "2024-01-20",
    location: "Los Angeles, USA",
    address: "456 Sunset Blvd, Los Angeles, CA 90028",
    status: "active",
    totalRevenue: "$98,200",
    totalOrders: 2150,
    verified: true,
    idDocument: "Verified - Passport",
    bankAccount: "****7832 - Bank of America",
    shops: [
      { id: "SHP-003", name: "Fashionista Boutique", category: "Fashion", products: 320, orders: 1800, revenue: "$78,200", rating: 4.9, status: "active", description: "Trendy women's fashion and accessories", commission: 15, createdDate: "2024-01-20" },
      { id: "SHP-004", name: "Kids Style Co", category: "Kids Fashion", products: 145, orders: 350, revenue: "$20,000", rating: 4.6, status: "active", description: "Stylish clothing for children", commission: 12, createdDate: "2024-04-10" },
    ],
    notes: [
      { date: "2024-12-20", text: "Top seller award Q4 2024" },
    ],
  },
  {
    id: "SLR-003",
    name: "Michael Chen",
    email: "michael@homegoods.com",
    phone: "+1 456 789 012",
    avatar: "MC",
    joinDate: "2024-06-10",
    location: "San Francisco, USA",
    address: "789 Market St, San Francisco, CA 94103",
    status: "pending",
    totalRevenue: "$12,800",
    totalOrders: 234,
    verified: false,
    idDocument: "Pending Review",
    bankAccount: "****1290 - Wells Fargo",
    shops: [
      { id: "SHP-005", name: "HomeGoods Plus", category: "Home & Living", products: 89, orders: 234, revenue: "$12,800", rating: 4.2, status: "active", description: "Quality home decor and furniture", commission: 10, createdDate: "2024-06-10" },
    ],
    notes: [
      { date: "2025-03-01", text: "Documents submitted, awaiting verification" },
    ],
  },
  {
    id: "SLR-004",
    name: "Emma Rodriguez",
    email: "emma@beautybliss.com",
    phone: "+1 567 890 123",
    avatar: "ER",
    joinDate: "2023-11-05",
    location: "Miami, USA",
    address: "321 Ocean Drive, Miami, FL 33139",
    status: "active",
    totalRevenue: "$210,750",
    totalOrders: 3420,
    verified: true,
    idDocument: "Verified - Driver's License",
    bankAccount: "****5678 - Citibank",
    shops: [
      { id: "SHP-006", name: "Beauty Bliss", category: "Beauty", products: 245, orders: 2800, revenue: "$168,000", rating: 4.9, status: "active", description: "Premium beauty and skincare products", commission: 18, createdDate: "2023-11-05" },
      { id: "SHP-007", name: "Wellness Hub", category: "Health", products: 98, orders: 620, revenue: "$42,750", rating: 4.7, status: "active", description: "Health supplements and wellness products", commission: 14, createdDate: "2024-02-18" },
    ],
    notes: [
      { date: "2025-01-05", text: "Highest revenue seller in Beauty category" },
      { date: "2025-02-28", text: "Requested premium seller badge" },
    ],
  },
  {
    id: "SLR-005",
    name: "David Kim",
    email: "david@sportmax.com",
    phone: "+1 678 901 234",
    avatar: "DK",
    joinDate: "2024-08-22",
    location: "Chicago, USA",
    address: "555 Michigan Ave, Chicago, IL 60611",
    status: "suspended",
    totalRevenue: "$5,400",
    totalOrders: 87,
    verified: true,
    idDocument: "Verified - National ID",
    bankAccount: "****3456 - US Bank",
    shops: [
      { id: "SHP-008", name: "SportMax Gear", category: "Sports", products: 67, orders: 87, revenue: "$5,400", rating: 3.8, status: "inactive", description: "Sports equipment and athletic gear", commission: 10, createdDate: "2024-08-22" },
    ],
    notes: [
      { date: "2025-02-10", text: "Suspended due to multiple customer complaints" },
      { date: "2025-02-15", text: "Seller contacted for resolution" },
    ],
  },
  {
    id: "SLR-006",
    name: "Lisa Thompson",
    email: "lisa@organicfarm.com",
    phone: "+1 789 012 345",
    avatar: "LT",
    joinDate: "2024-02-14",
    location: "Portland, USA",
    address: "678 Pearl District, Portland, OR 97209",
    status: "active",
    totalRevenue: "$67,300",
    totalOrders: 1560,
    verified: true,
    idDocument: "Verified - Passport",
    bankAccount: "****8901 - Capital One",
    shops: [
      { id: "SHP-009", name: "Organic Farm Fresh", category: "Grocery", products: 180, orders: 1200, revenue: "$52,000", rating: 4.8, status: "active", description: "Farm-to-table organic produce and goods", commission: 8, createdDate: "2024-02-14" },
      { id: "SHP-010", name: "Green Kitchen", category: "Organic Food", products: 65, orders: 360, revenue: "$15,300", rating: 4.4, status: "active", description: "Organic prepared meals and snacks", commission: 10, createdDate: "2024-07-01" },
    ],
    notes: [],
  },
];

export const sellerStatusConfig = {
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  suspended: { label: "Suspended", className: "bg-destructive/10 text-destructive border-destructive/20" },
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  rejected: { label: "Rejected", className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

export const shopStatusConfig = {
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  inactive: { label: "Inactive", className: "bg-muted text-muted-foreground border-border" },
};
