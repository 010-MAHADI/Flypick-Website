# Flypick E-commerce Platform

A full-stack e-commerce platform built with Django REST Framework and React, featuring a complete marketplace with customer and seller interfaces.

## 🚀 Features

### Customer Features
- **User Authentication**: Registration, login, JWT-based authentication
- **Product Browsing**: Search, filter, and browse products by categories
- **Shopping Cart**: Add/remove items, quantity management
- **Order Management**: Place orders, track status, view history
- **Reviews & Ratings**: Write and read product reviews
- **Address Management**: Multiple shipping addresses
- **Email Notifications**: Order confirmations, status updates, welcome emails

### Seller Features
- **Seller Dashboard**: Complete seller management interface
- **Shop Management**: Create and manage multiple shops
- **Product Management**: Add, edit, delete products with variants
- **Order Processing**: View and manage incoming orders
- **Inventory Management**: Stock tracking with low stock alerts
- **Coupon System**: Create and manage discount coupons
- **Analytics**: Sales and performance tracking

### Admin Features
- **User Management**: Manage customers and sellers
- **Product Moderation**: Approve/reject products
- **Order Oversight**: Monitor all platform orders
- **Email System**: Manage email templates and logs
- **Category Management**: Global product categories

## 🛠 Tech Stack

### Backend
- **Django 6.0.3** - Web framework
- **Django REST Framework** - API development
- **SQLite/PostgreSQL** - Database
- **JWT Authentication** - Secure authentication
- **SMTP Email System** - Automated email notifications

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Shadcn/ui** - UI components
- **React Router** - Navigation
- **Context API** - State management

## 📁 Project Structure

```
├── server/                 # Django backend
│   ├── backend/           # Main Django project
│   ├── users/             # User management
│   ├── products/          # Product management
│   ├── orders/            # Order processing
│   ├── cart/              # Shopping cart
│   ├── seller/            # Seller functionality
│   ├── reviews/           # Product reviews
│   ├── emails/            # Email notification system
│   └── utils/             # Utility functions
├── client/
│   ├── Customer_site/     # Customer React app
│   └── seller-side/       # Seller React app
└── storage/               # File uploads
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Git

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/010-MAHADI/SIPI-Website.git
   cd SIPI-Website
   ```

2. **Set up Python virtual environment**
   ```bash
   cd server
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run database migrations**
   ```bash
   python manage.py migrate
   ```

6. **Set up email templates**
   ```bash
   python manage.py setup_email_templates
   ```

7. **Create superuser**
   ```bash
   python manage.py createsuperuser
   ```

8. **Start the development server**
   ```bash
   python manage.py runserver
   ```

### Frontend Setup

#### Customer Site
```bash
cd client/Customer_site
npm install
npm run dev
```

#### Seller Dashboard
```bash
cd client/seller-side
npm install
npm run dev
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (SQLite for development)
USE_SQLITE=True

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=True
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_SENDER_NAME=Flypick

# Site Configuration
SITE_NAME=Flypick
FRONTEND_URL=http://localhost:5173
SELLER_FRONTEND_URL=http://localhost:5174
```

### Gmail SMTP Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password for Mail
3. Use the app password in `SMTP_PASS`

## 📚 API Documentation

The API provides comprehensive endpoints for all platform functionality:

- **Authentication**: `/api/auth/`
- **Products**: `/api/products/`
- **Orders**: `/api/orders/`
- **Cart**: `/api/cart/`
- **Seller**: `/api/seller/`
- **Reviews**: `/api/reviews/`
- **Emails**: `/api/emails/`

## 🧪 Testing

### Backend Tests
```bash
cd server
python manage.py test
```

### Email System Test
```bash
cd server
python test_email_system.py
```

### API Testing
Use the provided test scripts:
```bash
./test_cart_api.sh
./test_category_image_upload.sh
```

## 📧 Email System

The platform includes a comprehensive email notification system:

- **Welcome emails** for new users
- **Order confirmations** and status updates
- **Seller notifications** for new orders
- **Stock alerts** for low inventory
- **Professional HTML templates** with responsive design

## 🔒 Security Features

- JWT-based authentication
- CORS protection
- Rate limiting
- Input validation
- Secure file uploads
- Environment-based configuration

## 🚀 Deployment

### Production Checklist

1. Set `DEBUG=False` in production
2. Configure proper database (PostgreSQL recommended)
3. Set up static file serving
4. Configure email service (SendGrid, SES)
5. Set up SSL certificates
6. Configure domain and CORS settings

See [DEPLOYMENT.md](server/DEPLOYMENT.md) for detailed production deployment instructions.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in `/server/EMAIL_SYSTEM_DOCUMENTATION.md`
- Review API endpoints in `/server/API_ENDPOINTS.md`

## 🎯 Roadmap

- [ ] Mobile app development
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Payment gateway integration
- [ ] Advanced search with Elasticsearch
- [ ] Real-time notifications with WebSockets

## 👥 Team

- **Developer**: Mahadi
- **Project**: SIPI Website / Flypick E-commerce Platform

---

**Built with ❤️ using Django and React**
