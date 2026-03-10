@echo off
REM Development Setup Script for FlyPick Backend (Windows)

echo 🚀 Setting up FlyPick Backend for Development...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.8+ first.
    exit /b 1
)

REM Create virtual environment
echo 📦 Creating virtual environment...
python -m venv venv

REM Activate virtual environment
echo 🔌 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo 📥 Installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

REM Setup environment variables
if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ⚠️  Please edit .env file with your configuration before running migrations!
) else (
    echo ✅ .env file already exists
)

REM Run migrations
echo 🗄️  Running database migrations...
python manage.py migrate

REM Create superuser prompt
echo.
set /p response="👤 Would you like to create a superuser? (y/n): "
if /i "%response%"=="y" (
    python manage.py createsuperuser
)

echo.
echo ✅ Setup complete!
echo.
echo To start the development server:
echo   1. Activate virtual environment: venv\Scripts\activate
echo   2. Run server: python manage.py runserver
echo.
echo 📚 Documentation:
echo   - Deployment Guide: DEPLOYMENT.md
echo   - Security Info: SECURITY.md
echo   - Production Checklist: PRODUCTION_CHECKLIST.md
echo   - Bugs Fixed: BUGS_FIXED.md

pause
