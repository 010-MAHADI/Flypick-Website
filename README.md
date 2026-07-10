# Flypick E-Commerce Platform

A full-stack multi-vendor e-commerce marketplace built with **Django REST Framework** (backend) and **React + TypeScript** (frontend). The platform has three distinct interfaces: a customer-facing storefront, a seller/admin dashboard, and a Django admin panel.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Backend — Django Server](#4-backend--django-server)
   - [Django Apps](#41-django-apps)
   - [Database Models](#42-database-models)
   - [API Endpoints](#43-api-endpoints)
   - [Authentication & Security](#44-authentication--security)
   - [Email System](#45-email-system)
   - [File Uploads](#46-file-uploads)
5. [Frontend — Customer Site](#5-frontend--customer-site)
6. [Frontend — Seller Dashboard](#6-frontend--seller-dashboard)
7. [Environment Variables](#7-environment-variables)
8. [Local Development Setup](#8-local-development-setup)
9. [Production Deployment](#9-production-deployment)
10. [Data Flow Diagrams](#10-data-flow-diagrams)

---

## 1. System Architecture Overview

```
                          ┌─────────────────────────────────┐
                          │            Nginx                 │
                          │   (Reverse Proxy / SSL Term.)    │
                          └────────┬──────────────┬──────────┘
                                   │              │
              ┌────────────────────▼───┐     ┌────▼────────────────────┐
              │  Customer Site (SPA)   │     │  Seller Dashboard (SPA) │
              │  flypick.shop          │     │  seller.flypick.shop     │
              │  React + TypeScript    │     │  React + TypeScript      │
              │  Vite build / port 5173│     │  Vite build / port 8081  │
              └──────────┬─────────────┘     └────────────┬────────────┘
                         │  REST API calls                 │  REST API calls
                         └────────────────┬────────────────┘
                                          │
                          ┌───────────────▼──────────────────┐
                          │   Django REST Framework           │
                          │   Gunicorn (port 8000)            │
                          │   JWT Authentication              │
                          │   12 Django Apps                  │
                          └────────────┬─────────────────────┘
                                       │
                      ┌────────────────┼──────────────────┐
                      │                │                  │
             ┌────────▼──────┐  ┌──────▼──────┐  ┌───────▼───────┐
             │  PostgreSQL   │  │  File System │  │   SMTP Email  │
             │  (production) │  │  /storage/   │  │   (Gmail)     │
             │  SQLite (dev) │  │  media files │  │               │
             └───────────────┘  └─────────────┘  └───────────────┘
```

**Request flow:**
1. Browser hits Nginx on port 80/443.
2. Static HTML/JS/CSS for the React SPA is served directly by Nginx.
3. API calls (`/api/*`) and Django admin (`/admin/*`) are proxied to Gunicorn on port 8000.
4. Django authenticates the request via JWT, processes business logic, reads/writes PostgreSQL.
5. Uploaded media files are stored in `/storage/` and served via `/media/` through Nginx.

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend framework | Django | 4.2+ |
| API layer | Django REST Framework | 3.14+ |
| Auth | djangorestframework-simplejwt | 5.2+ |
| CORS | django-cors-headers | 4.0+ |
| Database (prod) | PostgreSQL | 14+ |
| Database (dev) | SQLite | built-in |
| DB driver | psycopg2-binary | 2.9+ |
| Task queue | Celery + Redis | 5.3+ / 4.6+ |
| Static files | WhiteNoise | 6.5+ |
| WSGI server | Gunicorn | 21.0+ |
| Image processing | Pillow | 10.0+ |
| Frontend framework | React | 18.3 |
| Language | TypeScript | 5.x |
| Build tool | Vite + SWC | 5.x |
| UI components | Shadcn/ui (Radix UI) | latest |
| Styling | Tailwind CSS | 3.x |
| Routing | React Router | 6.x |
| Data fetching | TanStack Query v5 + Axios | 5.x / 1.x |
| Forms | React Hook Form + Zod | 7.x / 3.x |
| Charts | Recharts | 2.x |
| Reverse proxy | Nginx | latest |
| SSL | Let's Encrypt (Certbot) | - |

---

## 3. Repository Structure

```
Flypick-Website/
├── server/                         # Django backend
│   ├── backend/                    # Django project config
│   │   ├── settings.py             # All settings (DB, JWT, CORS, email, etc.)
│   │   ├── urls.py                 # Root URL router
│   │   ├── wsgi.py                 # WSGI entry point
│   │   ├── asgi.py                 # ASGI entry point
│   │   └── health.py               # /api/health/ endpoint
│   ├── users/                      # User auth + profiles
│   ├── products/                   # Categories, shops, products, media
│   ├── orders/                     # Orders, payments, returns
│   ├── cart/                       # Shopping cart
│   ├── seller/                     # Seller-specific tools
│   ├── reviews/                    # Product reviews
│   ├── emails/                     # Email template system
│   ├── notifications/              # In-app notification system
│   ├── promotions/                 # Marketing campaigns
│   ├── chat/                       # Live chat (customer ↔ admin)
│   ├── utils/                      # File upload helpers
│   ├── logs/                       # Application logs
│   ├── manage.py
│   ├── requirements.txt
│   ├── seed.py                     # Database seed script
│   ├── .env.example                # All env vars documented
│   └── PRODUCTION_CHECKLIST.md
│
├── client/
│   ├── Customer_site/              # Customer-facing React app
│   │   ├── src/
│   │   │   ├── components/         # Reusable UI components
│   │   │   ├── pages/              # Route-level page components
│   │   │   ├── context/            # React Context providers
│   │   │   ├── hooks/              # Custom data hooks
│   │   │   ├── lib/                # Utility functions
│   │   │   └── App.tsx             # Root router
│   │   ├── public/                 # Favicon, robots.txt, etc.
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── vite.config.ts          # Dev server on port 5173
│   │
│   └── seller-side/                # Seller & Admin dashboard React app
│       ├── src/
│       │   ├── components/         # Shared components + AdminLayout
│       │   ├── pages/              # Dashboard pages
│       │   ├── context/            # AuthContext, ShopContext
│       │   ├── hooks/              # Custom data hooks
│       │   ├── lib/                # Utility functions
│       │   └── App.tsx             # Root router with role guards
│       ├── .env.example
│       ├── package.json
│       └── vite.config.ts          # Dev server on port 8081
│
├── storage/                        # Uploaded media files (images, videos)
├── scripts/                        # Env-switching shell/bat scripts
├── nginx.conf                      # Nginx reverse proxy config
├── MANUAL_DEPLOYMENT_GUIDE.md      # Step-by-step Linux deployment guide
└── README.md                       # This file
```

---

## 4. Backend — Django Server

### 4.1 Django Apps

Each folder under `server/` is a Django app. Here's what each one owns:

#### `backend/` — Project Configuration
- `settings.py`: Centralizes all configuration — database, JWT lifetimes, CORS origins, SMTP, media/static paths, security headers, throttling rates, file size limits.
- `urls.py`: Root URL dispatcher. Mounts all 12 app routers under `/api/`.
- `health.py`: Simple `GET /api/health/` endpoint for uptime monitoring.

#### `users/` — Authentication & User Profiles
- Custom user model (`CustomUser`) using email as the username field.
- Three roles: `Customer`, `Seller`, `Admin`.
- `SellerProfile`: business info, Bangladesh address fields, approval status, ID/bank document references.
- `CustomerProfile`: personal info, preferences, currency, language.
- `Address`: multiple shipping addresses per user with default flag.
- Social OAuth: Google and Apple (start + callback views).
- Seller request approval workflow: sellers register → status is `pending` → admin approves/rejects.
- JWT token views with custom claims.
- Dashboard stats endpoint for the seller dashboard.

#### `products/` — Catalog
- `Category`: hierarchical (self-referential parent FK), slug, image, active flag, sort order.
- `Shop`: belongs to a seller. Has sender address fields (used for shipping), revenue, commission rate.
- `Product`: the core model. Rich fields including JSON `variants` (colors, sizes, shipping options), JSON `badges`, three price fields (`price`, `originalPrice`, `actualCost`), stock count, SEO meta fields, return policy, warranty, weight.
- `ProductImage` / `ProductVideo`: gallery media with sort order.
- Separate upload views for single image, multiple images, video, category image.

#### `orders/` — Order Processing
- `Order`: links to customer, stores full shipping address snapshot, payment method (cod/bkash/nagad/credit_card), payment status, order status, coupon code, pricing breakdown (subtotal/shipping/discount/total).
- `OrderItem`: stores product snapshot at order time (title, image URL) so order history is preserved even if the product is edited/deleted. Includes variant info (color, size, shipping type).
- `ReturnRequest` / `ReturnItem`: return/refund workflow with admin approval.
- `PaymentMethod`: toggles payment methods on a per-shop or global basis.

#### `cart/` — Shopping Cart
- `Cart`: one cart per authenticated user.
- `CartItem`: product + variant selection (color, size, shipping type), selected flag, quantity.
- Price calculation uses `originalPrice` (discounted price) when available, falls back to `price`.

#### `seller/` — Seller Tools
- `Coupon`: discount codes. Types: `percent`, `fixed`, `free_shipping`. Scope: all products, specific products, category, or first order only. Configurable min order amount, max uses, expiry.
- `CouponProduct`: M2M for specific-product coupons.
- `PaymentMethodSetting`: per-seller toggle for each payment method.
- Views: analytics, transaction history, customer list, category management, review management.

#### `reviews/` — Product Reviews
- `Review`: 1–5 star rating, text, helpful count. Status: `published`, `pending`, `rejected`. One review per user per product (enforced by `unique_together`).
- `ReviewImage`: multiple photos per review.

#### `emails/` — Email System
- HTML email templates stored in the database (setup via `python manage.py setup_email_templates`).
- 8 built-in templates: welcome, order_confirmation, order_status_update, new_order_seller, low_stock_alert, out_of_stock_alert, promotion, base.
- SMTP via Gmail SSL (port 465). Configured entirely through environment variables.
- Email log for tracking sent emails.

#### `notifications/` — In-App Notifications
- `Notification`: 11 notification types (order states, payment, coupon, stock, price drop, welcome, system). Priority levels: low/medium/high/urgent. Optional action URL/text. Soft delete support.
- `NotificationPreference`: per-user granular toggle for email/in-app/push notifications per notification category.

#### `promotions/` — Marketing Campaigns
- Campaign management with audience targeting: all users, returning customers, new customers, inactive users, high-value customers.
- Email + in-app notification delivery.
- Metrics tracking (sent, opened, clicked).

#### `chat/` — Live Chat
- `ChatSession`: UUID PK. Can be anonymous (session_id) or authenticated. Assigned to an admin user. Status: active/closed.
- `ChatMessage`: belongs to session. Sender type: customer or admin. Read flag. Indexed by (session, created_at) for efficient pagination.

### 4.2 Database Models

Entity relationships at a glance:

```
CustomUser (1) ──── (1) SellerProfile
CustomUser (1) ──── (1) CustomerProfile
CustomUser (1) ──── (N) Address
CustomUser (1) ──── (1) Cart ──── (N) CartItem ──── (1) Product
CustomUser (1) ──── (N) Order ──── (N) OrderItem ──── (1) Product
CustomUser (1) ──── (N) Review ──── (1) Product
CustomUser (1) ──── (N) Notification
CustomUser (1) ──── (1) NotificationPreference
CustomUser (1) ──── (N) Shop ──── (N) Product ──── (N) ProductImage
                                                └──── (N) ProductVideo
Category (self-ref) ──── (N) Product
Category            ──── (N) Shop
Coupon (Seller) ──── (N) CouponProduct ──── (1) Product
Order (1) ──── (N) ReturnRequest ──── (N) ReturnItem ──── (1) OrderItem
ChatSession ──── (N) ChatMessage
```

### 4.3 API Endpoints

All endpoints are prefixed with `/api/`.

| Prefix | App | Description |
|--------|-----|-------------|
| `GET /api/health/` | backend | Health check |
| `/api/auth/` | users | Auth + profiles (see below) |
| `/api/users/` | users | Alias for `/api/auth/` |
| `/api/products/` | products | Catalog management |
| `/api/shops/` | products | Shop-only alias |
| `/api/orders/` | orders | Orders + returns |
| `/api/cart/` | cart | Cart management |
| `/api/seller/` | seller | Seller-specific endpoints |
| `/api/reviews/` | reviews | Product reviews |
| `/api/emails/` | emails | Email template management |
| `/api/notifications/` | notifications | In-app notifications |
| `/api/promotions/` | promotions | Marketing campaigns |
| `/api/chat/` | chat | Live chat sessions |

#### Auth endpoints (`/api/auth/`)
```
POST   register/                      Register as seller
POST   customer/register/             Register as customer
POST   token/                         Login → returns access + refresh JWT
POST   token/refresh/                 Refresh access token
GET    social/google/start/           Start Google OAuth flow
GET    social/google/callback/        Google OAuth callback
GET    social/apple/start/            Start Apple OAuth flow
POST   social/apple/callback/         Apple OAuth callback
GET    profile/                       Get seller profile
PATCH  profile/                       Update seller profile
GET    customer/profile/              Get customer profile
PATCH  customer/profile/              Update customer profile
GET    dashboard/stats/               Dashboard summary stats
GET    seller-requests/               List pending seller approvals (Admin)
PATCH  seller-requests/<id>/review/   Approve or reject a seller (Admin)
GET    sellers/list/                  List all sellers (Admin)
CRUD   addresses/                     Shipping address management
```

#### Products endpoints (`/api/products/`)
```
GET/POST           categories/                  List / create categories
GET/PUT/DEL        categories/<id>/             Category detail
GET/POST           shops/                       List / create shops
GET/PUT/DEL        shops/<id>/                  Shop detail
GET/POST           (root)                       List / create products
GET/PUT/DEL        <id>/                        Product detail
POST               upload-image/                Single product image
POST               upload-images/               Multiple product images
POST               upload-video/                Product video
POST               upload-category-image/       Category image
```

#### Orders endpoints (`/api/orders/`)
```
GET/POST       orders/                          List / create orders
GET/PUT        orders/<id>/                     Order detail + status update
GET/POST       returns/                         Return requests
GET/PUT        returns/<id>/                    Return detail
GET/PUT        payment-methods/                 Payment method config
```

#### Seller endpoints (`/api/seller/`)
```
CRUD           categories/                      Seller-scoped categories
CRUD           coupons/                         Coupon management
GET/PATCH      reviews/                         Review moderation
GET            customers/                       Seller's customers
GET            customers/<id>/                  Customer detail
GET            analytics/                       Sales analytics
GET            transactions/                    Transaction history
GET/PUT        transactions/payment-methods/    Payment method settings
```

#### Chat endpoints (`/api/chat/`)
```
GET/POST       session/            Get or create chat session
POST           message/            Send a message
GET            messages/           Fetch messages in a session
POST           read/               Mark messages as read
POST           close/              Close a chat session
GET            admin/sessions/     All sessions (Admin only)
POST           admin/assign/       Assign session to admin
```

### 4.4 Authentication & Security

- **JWT** with short-lived access tokens (15 min default) and rotating refresh tokens (1440 min = 24h).
- **Token blacklisting** on logout and rotation via `rest_framework_simplejwt.token_blacklist`.
- **CORS** restricted to specific origins via `CORS_ALLOWED_ORIGINS` env var.
- **Rate throttling** (production): 100 req/hour for anonymous, 1000 req/hour for authenticated users. Chat endpoint throttled at 1 msg/sec. Throttling disabled in `DEBUG` mode by default.
- **Production security headers**: HSTS, XSS protection, content-type sniff protection, `X-Frame-Options: DENY`.
- **File upload validation**: extension whitelist + size limits (images 10MB, videos 50MB, category images 2MB).
- **Role-based access**: Three roles enforced at both API permission classes and frontend route guards.

### 4.5 Email System

Configure SMTP credentials in `.env`, then:

```bash
# Load the 8 built-in HTML templates into the database
python manage.py setup_email_templates

# Test the full email pipeline
python test_email_system.py
```

Emails are sent on these events (via Django signals or explicit calls):
- User registration → welcome email
- Order placed → confirmation to customer + notification to seller
- Order status change → update email to customer
- Low stock / out of stock → alert to seller
- Admin sends promotion campaign → bulk email to target audience

### 4.6 File Uploads

Media files land in `/storage/` (the `storage/` folder at the repo root, one level above `server/`). This is set in `settings.py` as `MEDIA_ROOT`. Nginx serves these files at the `/media/` URL path in production.

Upload size limits:
- Product images: 10MB (JPG, JPEG, PNG, WEBP, GIF)
- Product videos: 50MB (MP4, WEBM, MOV)
- Category images: 2MB
- User avatars: 2MB

---

## 5. Frontend — Customer Site

**Location:** `client/Customer_site/`  
**Dev port:** `5173`  
**Build output:** `dist/` (served by Nginx at the root domain)

### Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Index | Home — hero banner, category section, deals, product grid |
| `/auth` | Auth | Login + registration tabs |
| `/product/:id` | ProductDetail | Legacy URL (backward compat) |
| `/product/:id/:slug` | ProductDetail | Legacy URL with slug |
| `/:category/:slug` | ProductDetail | SEO-canonical product URL |
| `/cart` | Cart | Cart with item management |
| `/checkout` | Checkout | Address selection + payment method |
| `/order-confirmation/:orderId` | OrderConfirmation | Post-purchase confirmation |
| `/orders` | Orders | Order history list |
| `/order/:orderId` | OrderDetail | Single order detail |
| `/track-order/:orderId` | TrackOrder | Real-time order tracking |
| `/account` | Account | Profile, addresses, preferences |
| `/notifications` | Notifications | In-app notification centre |
| `/search` | Search | Product search with filters |
| `/wishlist` | Wishlist | Saved products |
| `/super-deals` | SuperDeals | Promotional deals page |
| `/bundle-deals` | BundleDeals | Bundle offers |
| `/returns` | Returns | Return history |
| `/return-request/:orderId` | ReturnRequest | Initiate a return |
| `/write-review/:orderId/:itemId` | WriteReview | Post-purchase review form |
| `/live-chat` | LiveChatPage | Dedicated chat page |
| `/about`, `/contact`, `/faq` | Static pages | Informational pages |
| `/privacy-policy`, `/terms-of-service`, `/return-policy`, `/shipping-policy` | Policy pages | Legal pages |

A floating `<LiveChat />` widget is mounted globally in the router, visible on all pages.

### State Management (Context Providers)

| Context | Responsibilities |
|---------|-----------------|
| `AuthContext` | JWT tokens, login/logout, current user, token refresh |
| `CartContext` | Cart items, add/remove/update, cart total calculation |
| `OrderContext` | Order history, order placement, order status |
| `AddressContext` | Saved shipping addresses, default address |
| `WishlistContext` | Wishlist items, add/remove |

### Key Components

| Component | Purpose |
|-----------|---------|
| `SiteHeader` | Top nav with search, cart icon, auth links, notification bell |
| `SiteFooter` | Footer with links and social icons |
| `HeroBanner` | Homepage hero carousel |
| `ProductCard` | Reusable product tile with price, rating, badges |
| `ProductGrid` | Paginated grid of ProductCards |
| `CategorySection` | Horizontal scrollable category chips |
| `DealsSection` | Flash deals / time-limited offers |
| `ProductReviews` | Star rating display + review list on PDP |
| `ProductCoupons` | Available coupons on PDP |
| `ProductDescription` | Rich text description tab |
| `ProductSpecifications` | Spec table tab |
| `NotificationBell` | Dropdown notification panel in header |
| `LiveChat` | Floating chat widget (global) |
| `TakaSign` | BDT currency symbol component |
| `ScrollToTop` | Scrolls to top on route change |

### Environment Variables

```env
# client/Customer_site/.env
VITE_API_BASE_URL=http://localhost:8000/api/
```

---

## 6. Frontend — Seller Dashboard

**Location:** `client/seller-side/`  
**Dev port:** `8081`  
**Build output:** `dist/` (served by Nginx at `seller.flypick.shop`)

This app serves both **Sellers** and **Admins**. The same codebase uses role-based route guards (`RoleRoute`) to show or hide pages depending on role.

### Role Access Matrix

| Page | Seller | Admin |
|------|--------|-------|
| Dashboard | ✅ | ✅ |
| Products (own shop) | ✅ | ✅ |
| Orders | ✅ | ✅ |
| Analytics | ✅ | ✅ |
| Coupons | ✅ | ✅ |
| Notifications | ✅ | ✅ |
| Settings | ✅ | ✅ |
| Promotions | ✅ | ✅ |
| Customers | ❌ | ✅ |
| Categories (global) | ❌ | ✅ |
| Reviews (moderation) | ❌ | ✅ |
| Transactions (all) | ❌ | ✅ |
| Sellers list | ❌ | ✅ |
| Seller detail | ❌ | ✅ |
| Seller requests | ❌ | ✅ |
| Banners | ❌ | ✅ |
| Chat admin | ❌ | ✅ |

### Pages

| Route | Page | Notes |
|-------|------|-------|
| `/auth` | Auth | Login only — registration happens on customer site |
| `/shop-selector` | ShopSelector | Seller picks which shop to manage |
| `/create-shop` | CreateShop | New shop creation flow |
| `/` | Dashboard | KPIs, recent orders, revenue summary |
| `/products` | Products | Product list with filters and status |
| `/products/new` | ProductForm | Add new product (variants, media, pricing) |
| `/products/:id/edit` | ProductForm | Edit existing product |
| `/orders` | Orders | Order list with status management |
| `/analytics` | Analytics | Charts: sales, revenue, top products |
| `/coupons` | Coupons | Coupon CRUD |
| `/notifications` | Notifications | Platform notifications |
| `/settings` | Settings | Shop info, payment methods |
| `/promotions` | Promotions | Campaign management |
| `/customers` | Customers | All customers (Admin) |
| `/categories` | Categories | Global category management (Admin) |
| `/reviews` | Reviews | Review moderation queue (Admin) |
| `/transactions` | Transactions | Full transaction log (Admin) |
| `/sellers` | Sellers | Registered sellers list (Admin) |
| `/sellers/:id` | SellerDetail | Seller profile + shop details (Admin) |
| `/seller-requests` | SellerRequests | Pending seller approvals (Admin) |
| `/banners` | Banners | Homepage banner management (Admin) |
| `/chat` | ChatAdmin | Live chat inbox — all sessions (Admin) |

### State Management

| Context | Responsibilities |
|---------|-----------------|
| `AuthContext` | JWT auth shared with customer logic; role detection (`is_superuser` → Admin) |
| `ShopContext` | Currently selected shop for multi-shop sellers |

### Custom Hooks (data layer)

The seller dashboard abstracts all API calls into custom hooks:

```
useProducts, useOrders, useAnalytics, useCoupons,
useCustomers, usePromotions, useTransactions, useReviews,
useDashboard, useSellers, useReturns, useNotifications,
useSettings, useBanners, useChat
```

Each hook uses **TanStack Query** for caching, background refresh, and loading/error states.

### Environment Variables

```env
# client/seller-side/.env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_MEDIA_URL=http://localhost:8000/media
VITE_SITE_NAME=Flypick
VITE_CUSTOMER_URL=http://localhost:5173
```

---

## 7. Environment Variables

### Backend (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | insecure default | Django secret key — **change in production** |
| `DEBUG` | `False` | Enable Django debug mode |
| `ALLOWED_HOSTS` | `54.169.101.239` | Comma-separated allowed hostnames |
| `USE_SQLITE` | `False` | Set `True` to use SQLite instead of PostgreSQL |
| `DB_ENGINE` | `django.db.backends.postgresql` | Database backend |
| `DB_NAME` | `flypick_db` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `password` | Database password |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `CORS_ALLOWED_ORIGINS` | `http://54.169.101.239,...` | Comma-separated allowed frontend origins |
| `JWT_ACCESS_TOKEN_LIFETIME` | `15` | Access token lifetime in minutes |
| `JWT_REFRESH_TOKEN_LIFETIME` | `1440` | Refresh token lifetime in minutes (24h) |
| `SECURE_SSL_REDIRECT` | `True` | Force HTTPS redirect (production) |
| `SESSION_COOKIE_SECURE` | `True` | Secure session cookies (production) |
| `CSRF_COOKIE_SECURE` | `True` | Secure CSRF cookies (production) |
| `SMTP_HOST` | `smtp.gmail.com` | Email SMTP host |
| `SMTP_PORT` | `465` | Email SMTP port |
| `SMTP_SECURE` | `True` | Use SSL for SMTP |
| `SMTP_USER` | — | SMTP email address |
| `SMTP_PASS` | — | SMTP app password |
| `EMAIL_SENDER_NAME` | `Flypick` | Display name in From field |
| `SITE_NAME` | `Flypick` | Platform name |
| `FRONTEND_URL` | `http://54.169.101.239` | Customer site URL |
| `SELLER_FRONTEND_URL` | `http://54.169.101.239:8080` | Seller dashboard URL |
| `BACKEND_PUBLIC_URL` | equals `FRONTEND_URL` | Public backend URL (for media links in emails) |
| `GOOGLE_OAUTH_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | — | Google OAuth client secret |
| `APPLE_OAUTH_CLIENT_ID` | — | Apple OAuth service ID |
| `APPLE_OAUTH_TEAM_ID` | — | Apple Developer Team ID |
| `APPLE_OAUTH_KEY_ID` | — | Apple private key ID |
| `APPLE_OAUTH_PRIVATE_KEY` | — | Apple private key PEM content |
| `THROTTLE_ANON_RATE` | `100/hour` | Rate limit for unauthenticated requests |
| `THROTTLE_USER_RATE` | `1000/hour` | Rate limit for authenticated requests |
| `DISABLE_THROTTLING_IN_DEBUG` | `True` | Skip throttling in debug mode |

### Customer Site (`client/Customer_site/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Full URL to the Django API (e.g. `http://localhost:8000/api/`) |

### Seller Dashboard (`client/seller-side/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Full URL to the Django API |
| `VITE_MEDIA_URL` | Base URL for media files (e.g. `http://localhost:8000/media`) |
| `VITE_SITE_NAME` | Platform display name |
| `VITE_CUSTOMER_URL` | URL of the customer site (for cross-linking) |

---

## 8. Local Development Setup

### Prerequisites

- Python 3.8+
- Node.js 18+ (or Bun)
- Git
- PostgreSQL 14+ (or skip it and use SQLite in dev)

### Step 1 — Clone the repo

```bash
git clone https://github.com/010-MAHADI/Flypick-Website.git
cd Flypick-Website
```

### Step 2 — Backend setup

```bash
cd server

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy and configure env
cp .env.example .env
# Edit .env — set USE_SQLITE=True for local dev, configure SMTP

# Run migrations
python manage.py migrate

# Load email templates
python manage.py setup_email_templates

# (Optional) Load seed data
python seed.py

# Create an admin user
python manage.py createsuperuser

# Start dev server
python manage.py runserver
# API available at http://localhost:8000
# Admin panel at http://localhost:8000/admin/
```

### Step 3 — Customer site setup

```bash
cd client/Customer_site

# Install dependencies
npm install

# Configure env
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8000/api/

# Start dev server
npm run dev
# App available at http://localhost:5173
```

### Step 4 — Seller dashboard setup

```bash
cd client/seller-side

# Install dependencies
npm install

# Configure env
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8000/api
# VITE_MEDIA_URL=http://localhost:8000/media
# VITE_SITE_NAME=Flypick
# VITE_CUSTOMER_URL=http://localhost:5173

# Start dev server
npm run dev
# App available at http://localhost:8081
```

### Running Tests

```bash
# Backend unit tests
cd server
python manage.py test

# Email system integration test
python test_email_system.py

# Frontend tests (customer site)
cd client/Customer_site
npm test

# Frontend tests (seller dashboard)
cd client/seller-side
npm test
```

---

## 9. Production Deployment

The full step-by-step Linux deployment guide is in `MANUAL_DEPLOYMENT_GUIDE.md`. Here's the high-level overview.

### Infrastructure

```
Ubuntu Server (AWS EC2 / any VPS)
├── PostgreSQL 14+              (database)
├── Gunicorn                    (Django WSGI server on 127.0.0.1:8000)
├── Nginx                       (reverse proxy + static/media file serving)
├── Certbot / Let's Encrypt     (SSL certificates)
└── systemd service: flypick    (keeps Gunicorn running)
```

### Domains

| Domain | Serves |
|--------|--------|
| `flypick.shop` | Customer site + `/api/` + `/admin/` + `/media/` |
| `seller.flypick.shop` | Seller dashboard (proxies `/api/` to the same backend) |

### Build & Deploy Steps (summary)

```bash
# 1. Pull latest code
git pull origin main

# 2. Update Python deps and migrate
cd server && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# 3. Build customer site
cd ../client/Customer_site && npm install && npm run build

# 4. Build seller dashboard
cd ../seller-side && npm install && npm run build

# 5. Restart application server
sudo systemctl restart flypick
```

Nginx configuration serves the compiled `dist/` folders as static files and proxies all `/api/` and `/admin/` requests to Gunicorn. See `nginx.conf` at the repo root for the full configuration.

### Key systemd Service (`/etc/systemd/system/flypick.service`)

```ini
[Service]
WorkingDirectory=/home/flypick/Flypick-Website/server
ExecStart=/path/to/venv/bin/gunicorn \
          --workers 3 \
          --bind 127.0.0.1:8000 \
          backend.wsgi:application
Restart=always
```

### Automated Backups

The deployment guide includes a `backup.sh` script that:
- Dumps PostgreSQL to a `.sql` file daily (cron at 2 AM)
- Archives the `/storage/` media directory
- Retains the last 7 days of backups

---

## 10. Data Flow Diagrams

### Customer Places an Order

```
Browser
  │  POST /api/orders/orders/   (JWT in Authorization header)
  ▼
Django OrderViewSet
  │  Validate cart items + stock
  │  Apply coupon discount
  │  Create Order + OrderItems
  │  Decrement product stock
  │  Send email (order_confirmation → customer)
  │  Send email (new_order_seller → seller)
  │  Create Notification records
  ▼
PostgreSQL
```

### Seller Approves a Seller Request

```
Admin Dashboard
  │  PATCH /api/auth/seller-requests/<id>/review/
  ▼
SellerRequestReviewAPIView
  │  Update SellerProfile.status → 'active'
  │  Send email notification to seller
  ▼
PostgreSQL
```

### Live Chat Flow

```
Customer (anonymous or authenticated)
  │  POST /api/chat/session/     → creates ChatSession
  │  POST /api/chat/message/     → creates ChatMessage (sender_type=customer)
  │  GET  /api/chat/messages/    → polling for new messages
  ▼
Admin Dashboard (ChatAdmin page)
  │  GET  /api/chat/admin/sessions/    → all active sessions
  │  POST /api/chat/admin/assign/      → admin takes ownership
  │  POST /api/chat/message/           → reply (sender_type=admin)
  ▼
PostgreSQL
```

### JWT Authentication Flow

```
Client
  │  POST /api/auth/token/  { email, password }
  ▼
CustomTokenObtainPairView
  │  Returns { access (15min), refresh (24h) }
  ▼
Client stores tokens (memory / localStorage)

On every API request:
  Authorization: Bearer <access_token>

When access expires:
  POST /api/auth/token/refresh/  { refresh }
  → New access + rotated refresh token
  → Old refresh token is blacklisted
```

---

## 11. Universal Product Import Engine

Admins and sellers can import products directly from external e-commerce sites: paste a product URL, review/edit an auto-generated preview, and save it as a Draft product with all images copied into our own storage.

**Site support (three tiers):**

1. **Dedicated importers** (JS-blob parsing): AliExpress · Daraz · ElectronicsBD · RoboticsBD
2. **Domain profiles** (zero-code, selector hints): Star Tech, Ryans Computers, TechLand BD, Computer Mania BD, PC House, PC Builder Bangladesh, Computer Source, UCC, Global Brand PLC, Binary Logic, Ultra Technology, Skyland BD
3. **Universal fallback**: *any other product URL* is attempted via JSON-LD → OpenGraph → microdata → common e-commerce selectors (WooCommerce/OpenCart/Magento/Shopify/PrestaShop) → price-pair & stock heuristics

**Admin UI:** Seller dashboard → *Import Product* (or Products → *Import from URL*) → paste URL → Import → edit preview → Save. Imported products are saved as **Draft** and remain fully editable in the normal product form.

**API (JWT):**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/importer/sources/` | GET | List supported websites (dedicated + profiles + generic) |
| `/api/importer/preview/` | POST `{url, refresh?}` | Fetch + parse + normalize + enrich; returns editable preview JSON (cached 15 min) |
| `/api/importer/save/` | POST `{shop, source_url, product, images[]}` | Download selected images (original/medium/thumb), create the product + its primary ProductSource |
| `/api/importer/jobs/` | GET | Recent import audit log |
| `/api/importer/products/<id>/sources/` | GET/POST | **Admin-only**: list / add source URLs (primary + alternatives) |
| `/api/importer/product-sources/<id>/` | DELETE | **Admin-only**: remove a source |
| `/api/importer/product-sources/<id>/sync/` | POST | **Admin-only**: sync a source right now |

**Source tracking & stock synchronization:**

- Every imported product permanently stores its source URL(s) in the `ProductSource` table (primary + unlimited alternatives). Source URLs are **never** exposed through the public product API — only admins see them, in the *Source Information* section of the product edit page.
- Primary sources are re-checked automatically. Schedule the command daily; each source is re-fetched only when its own interval (2–5 days, default 3) has elapsed:

  ```
  # Linux cron (daily 04:15)
  15 4 * * * cd /path/server && python manage.py sync_imported_products
  # or Windows Task Scheduler / Celery beat (importer.tasks.sync_imported_products_task)
  ```

- A sync updates stock quantity/status (`in_stock / out_of_stock / limited_stock / pre_order / unknown`), flips the product to *Out of Stock* (and back) automatically, and detects removed pages, unreachable sources and dramatic price changes (`IMPORTER_PRICE_CHANGE_THRESHOLD`, default 20%). Significant changes trigger **email notifications** to the product's seller and all administrators (logged in EmailLog). After 5 consecutive failures a source's auto-sync is disabled.

**Architecture (`server/importer/`):**

```
engine.py            Orchestrator: detect → fetch → parse → normalize → enrich (+ cache, ImportJob logging)
importers/base.py    BaseImporter contract + JSON-LD/OpenGraph/microdata fallbacks + price/stock heuristics
importers/<site>.py  Dedicated importers (registered in importers/__init__.py)
importers/generic.py Universal fallback importer (works on any URL)
importers/profiles.py Domain profiles — add a store with one data entry
pricing.py           Selling/regular price-pair resolution (del/ins, class conventions, JSON-LD)
stock.py             Availability normalization ("Only 3 left" → limited_stock, qty 3)
http_client.py       SSRF-safe fetcher: public-IP validation, redirect re-validation, retries, size caps
sanitizer.py         Allowlist HTML sanitizer (no scripts/handlers/iframes survive)
enrichment.py        SEO title/description, slug, tags, category suggestion, highlights (AIEnhancer = LLM hook)
images.py            Safe image download + Pillow validation + 3 renditions in /storage/products/images/
sync.py              Automatic stock synchronization service
notifications.py     Seller/admin email alerts on significant changes
models.py            ImportJob audit log + ProductSource (both in Django admin)
```

**Adding a new website:** add one `DomainProfile` entry in `importers/profiles.py` (name + optional selector hints), or — for sites that hide data in JavaScript — one `BaseImporter` subclass registered in `importers/__init__.py`. Nothing else changes. Errors are returned as `{error: {code, message}}` with stable codes (`INVALID_URL`, `PRODUCT_NOT_FOUND`, `CONNECTION_TIMEOUT`, `BLOCKED_REQUEST`, `PARSING_ERROR`, …) and one failing website never affects the rest of the system. Import activity is logged to `server/logs/importer.log`.

> Notes: AliExpress often serves JavaScript-only pages to servers (anti-bot); the engine retries with locale cookies, then skips gracefully with a clear `BLOCKED_REQUEST` message. Ryans Computers currently blocks server-side requests (Cloudflare) — also handled gracefully.

---

## Quick Reference

| Task | Command |
|------|---------|
| Start backend | `cd server && python manage.py runserver` |
| Start customer site | `cd client/Customer_site && npm run dev` |
| Start seller dashboard | `cd client/seller-side && npm run dev` |
| Run backend tests | `cd server && python manage.py test` |
| Apply DB migrations | `cd server && python manage.py migrate` |
| Create admin user | `cd server && python manage.py createsuperuser` |
| Load email templates | `cd server && python manage.py setup_email_templates` |
| Sync imported products | `cd server && python manage.py sync_imported_products` |
| Build customer site | `cd client/Customer_site && npm run build` |
| Build seller dashboard | `cd client/seller-side && npm run build` |
| Production restart | `sudo systemctl restart flypick` |
| View backend logs | `sudo journalctl -u flypick -f` |

---

*Built with Django and React · Currency: BDT (Bangladeshi Taka) · Default country: Bangladesh*
