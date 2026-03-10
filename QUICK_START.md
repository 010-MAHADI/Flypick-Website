# 🚀 Quick Start Guide

## ⚡ Get Running in 5 Minutes

### 1️⃣ Backend Setup (2 minutes)

```bash
cd server

# Windows
setup_dev.bat

# Linux/Mac
bash setup_dev.sh
```

This will:
- Create virtual environment
- Install dependencies
- Create .env file
- Run migrations
- Prompt for superuser creation

### 2️⃣ Start Backend Server

```bash
# Activate virtual environment first
# Windows:
venv\Scripts\activate

# Linux/Mac:
source venv/bin/activate

# Run server
python manage.py runserver
```

Backend will be available at: `http://localhost:8000`

### 3️⃣ Customer Site Setup (1 minute)

```bash
cd client/Customer_site
cp .env.example .env
npm install
npm run dev
```

Customer site will be available at: `http://localhost:5173`

### 4️⃣ Seller Dashboard Setup (1 minute)

```bash
cd client/seller-side
cp .env.example .env
npm install
npm run dev
```

Seller dashboard will be available at: `http://localhost:5174`

## 🎯 Default Credentials

After running setup, create a superuser when prompted or run:
```bash
python manage.py createsuperuser
```

## 📍 Access Points

- **API**: http://localhost:8000/api/
- **Admin Panel**: http://localhost:8000/admin/
- **Customer Site**: http://localhost:5173
- **Seller Dashboard**: http://localhost:5174

## 🔧 Common Commands

### Backend
```bash
# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run tests
python manage.py test

# Check deployment readiness
python manage.py check --deploy

# Collect static files
python manage.py collectstatic
```

### Frontend
```bash
# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Lint code
npm run lint
```

## 🐛 Troubleshooting

### Backend won't start
- Check if PostgreSQL is running
- Verify database credentials in `.env`
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt`

### Frontend won't start
- Delete `node_modules` and run `npm install` again
- Check if `.env` file exists
- Verify Node.js version (should be 16+)

### Database connection error
- Ensure PostgreSQL is installed and running
- Create database: `createdb flypick_db`
- Check credentials in `server/.env`

### CORS errors
- Verify `CORS_ALLOWED_ORIGINS` in `server/.env`
- Check frontend URLs match the CORS settings
- Ensure both frontend and backend are running

## 📚 Next Steps

1. **Development**: Start coding! Everything is set up.
2. **Production**: Follow `server/PRODUCTION_CHECKLIST.md`
3. **Security**: Review `server/SECURITY.md`
4. **Deployment**: Read `server/DEPLOYMENT.md`

## 💡 Tips

- Always activate virtual environment before running Django commands
- Keep `.env` files secure and never commit them
- Run tests before deploying: `python manage.py test`
- Use `DEBUG=True` only in development

## 🆘 Need Help?

Check these files:
- `README.md` - Full project documentation
- `FIXES_SUMMARY.md` - What was fixed and why
- `server/BUGS_FIXED.md` - Detailed bug fixes
- `server/DEPLOYMENT.md` - Production deployment guide
