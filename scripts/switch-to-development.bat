@echo off
echo Switching to Development Environment...
echo.

REM Create development environment files
echo Creating development environment files...

REM Server development environment
echo # Development Environment Variables > "server\.env"
echo SECRET_KEY=your-secret-key-here-generate-new-one >> "server\.env"
echo DEBUG=True >> "server\.env"
echo ALLOWED_HOSTS=localhost,127.0.0.1 >> "server\.env"
echo. >> "server\.env"
echo # Database - Use SQLite for development >> "server\.env"
echo USE_SQLITE=True >> "server\.env"
echo. >> "server\.env"
echo # CORS Settings for local development >> "server\.env"
echo CORS_ALLOWED_ORIGINS=http://localhost:8080,http://localhost:8081,http://127.0.0.1:8080,http://127.0.0.1:8081 >> "server\.env"
echo. >> "server\.env"
echo # Site Configuration for local development >> "server\.env"
echo SITE_NAME=Flypick (Local) >> "server\.env"
echo FRONTEND_URL=http://localhost:8080 >> "server\.env"
echo SELLER_FRONTEND_URL=http://localhost:8081 >> "server\.env"

REM Customer site development environment
echo # Development Environment Variables for Customer Site > "client\Customer_site\.env"
echo VITE_API_BASE_URL=http://localhost:8000/api >> "client\Customer_site\.env"
echo VITE_MEDIA_URL=http://localhost:8000/media >> "client\Customer_site\.env"
echo VITE_SITE_NAME=Flypick >> "client\Customer_site\.env"
echo VITE_SELLER_URL=http://localhost:8081 >> "client\Customer_site\.env"

REM Seller dashboard development environment
echo # Development Environment Variables for Seller Dashboard > "client\seller-side\.env"
echo VITE_API_BASE_URL=http://localhost:8000/api >> "client\seller-side\.env"
echo VITE_MEDIA_URL=http://localhost:8000/media >> "client\seller-side\.env"
echo VITE_SITE_NAME=Flypick >> "client\seller-side\.env"
echo VITE_CUSTOMER_URL=http://localhost:8080 >> "client\seller-side\.env"

echo.
echo ✅ Development environment configured!
echo.
echo Development URLs:
echo - Customer Site: http://localhost:8080
echo - Seller Dashboard: http://localhost:8081
echo - API Server: http://localhost:8000
echo.
echo Next steps:
echo 1. Start the Django server:
echo    cd server && python manage.py runserver
echo.
echo 2. Start the frontend applications:
echo    cd client/Customer_site && npm run dev
echo    cd client/seller-side && npm run dev
echo.
pause