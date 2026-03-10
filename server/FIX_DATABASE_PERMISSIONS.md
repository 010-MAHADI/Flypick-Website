# Fix Database Permission Error

## Problem
```
permission denied for schema public
```

This means your PostgreSQL user doesn't have permission to create tables in the database.

## Solution

### Option 1: Grant Permissions (Recommended)

Connect to PostgreSQL as a superuser and run:

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE flypick_db TO postgres;
GRANT ALL ON SCHEMA public TO postgres;
ALTER DATABASE flypick_db OWNER TO postgres;

-- If using a different user, replace 'postgres' with your username
```

### Option 2: Use SQLite for Development (Quick Fix)

If you just want to test quickly, use SQLite instead of PostgreSQL:

1. Edit `server/.env` and comment out or remove the database settings
2. Update `server/backend/settings.py` database configuration:

```python
# Use SQLite for development
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
```

Then run migrations again:
```bash
python manage.py migrate
```

### Option 3: Recreate Database with Proper Permissions

```bash
# Connect to PostgreSQL
psql -U postgres

# Drop and recreate database
DROP DATABASE IF EXISTS flypick_db;
CREATE DATABASE flypick_db;
GRANT ALL PRIVILEGES ON DATABASE flypick_db TO postgres;

# Exit psql
\q

# Run migrations
python manage.py migrate
```

### Option 4: Fix PostgreSQL 15+ Public Schema Permissions

PostgreSQL 15+ changed default permissions. Run this:

```sql
-- Connect to the database
psql -U postgres -d flypick_db

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
ALTER SCHEMA public OWNER TO postgres;

-- Exit
\q
```

## After Fixing Permissions

Run migrations:
```bash
cd server
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## Quick Test with SQLite

If you want to test immediately without fixing PostgreSQL:

1. Edit `server/.env`:
```env
# Comment out PostgreSQL settings
# DB_ENGINE=django.db.backends.postgresql
# DB_NAME=flypick_db
# DB_USER=postgres
# DB_PASSWORD=password
# DB_HOST=localhost
# DB_PORT=5432

# Use SQLite (add this line)
USE_SQLITE=True
```

2. Update `server/backend/settings.py`:
```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent

# Database configuration
if os.getenv('USE_SQLITE') == 'True':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": os.getenv('DB_ENGINE', 'django.db.backends.postgresql'),
            "NAME": os.getenv('DB_NAME', 'flypick_db'),
            "USER": os.getenv('DB_USER', 'postgres'),
            "PASSWORD": os.getenv('DB_PASSWORD', 'password'),
            "HOST": os.getenv('DB_HOST', 'localhost'),
            "PORT": os.getenv('DB_PORT', '5432'),
        }
    }
```

3. Run migrations:
```bash
python manage.py migrate
```

This will create a local SQLite database file for development.
