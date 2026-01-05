# IntelliSight Database Connection Guide
## How Your System Connects to PostgreSQL on Windows

---

## 🔌 Current Database Connection

### Connection Details:
```
Host: 127.0.0.1 (localhost - Windows PostgreSQL accessible from WSL)
Port: 5000 (NOT the default 5432!)
Database: FYP_Intellisight
Username: postgres
Password: ozair
```

### Connection String:
```
postgresql://postgres:ozair@127.0.0.1:5000/FYP_Intellisight?schema=public
```

---

## 📍 Where Your System Connects to Database

### 1. **Environment Configuration** (.env file)
**Location**: `/mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP/.env`

```env
DATABASE_URL="postgresql://postgres:ozair@127.0.0.1:5000/FYP_Intellisight?schema=public"
```

This is the **PRIMARY** connection string used by:
- ✅ Prisma ORM
- ✅ Database migrations
- ✅ Backend API server

### 2. **Prisma Client** (src/config/database.js)
**Location**: `/mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP/src/config/database.js`

```javascript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
```

This creates the database client that all backend controllers use.

### 3. **GPU Face Service** (Facerecongination/gpu_face_service_lite.py)
**Location**: `/mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP/Facerecongination/gpu_face_service_lite.py`

```python
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5000,
    'database': 'FYP_Intellisight',
    'user': 'postgres',
    'password': 'ozair'
}
```

Uses psycopg2 to directly connect to PostgreSQL for logging attendance.

---

## 💾 How to Fetch Data from Windows PostgreSQL

### Method 1: Using pgAdmin (Windows GUI Tool)

1. **Open pgAdmin** on Windows
2. **Right-click** on "Servers" → "Register" → "Server"
3. **Configure**:
   - Name: `IntelliSight`
   - Host: `localhost`
   - Port: `5000`
   - Database: `FYP_Intellisight`
   - Username: `postgres`
   - Password: `ozair`
4. **Connect** and browse tables

### Method 2: Using psql Command Line (Windows)

Open **Command Prompt** or **PowerShell** on Windows:

```cmd
# Connect to database
psql -h localhost -p 5000 -U postgres -d FYP_Intellisight

# Enter password when prompted: ozair

# Run queries
SELECT * FROM "Admin";
SELECT * FROM "Teacher";
SELECT * FROM "Zone";
SELECT * FROM "Students";
SELECT * FROM "AttendanceLog";
```

### Method 3: From WSL Ubuntu (Current Environment)

```bash
# Using Prisma (Recommended)
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP

# Query all admins
npx prisma db execute --stdin <<< 'SELECT * FROM "Admin";'

# Query all teachers
npx prisma db execute --stdin <<< 'SELECT * FROM "Teacher";'

# Query all students
npx prisma db execute --stdin <<< 'SELECT * FROM "Students";'

# Query all zones
npx prisma db execute --stdin <<< 'SELECT * FROM "Zone";'

# Query attendance logs
npx prisma db execute --stdin <<< 'SELECT * FROM "AttendanceLog" LIMIT 10;'
```

### Method 4: Using Backend API

```bash
# Get all students
curl http://localhost:3000/api/students

# Get all teachers
curl http://localhost:3000/api/teachers

# Get all zones
curl http://localhost:3000/api/zones

# Get current persons in zone 1
curl http://localhost:3000/api/zones/1/current

# Check health (shows database status)
curl http://localhost:3000/api/health
```

---

## 🔍 Quick Database Test Script

Run this to verify your database connection and see all data:

```bash
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP

# Test 1: Check tables exist
echo "=== Checking Tables ==="
npx prisma db execute --stdin <<< "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
"

# Test 2: Count records
echo "=== Counting Records ==="
npx prisma db execute --stdin <<< "
SELECT 
  (SELECT COUNT(*) FROM \"Admin\") as admin_count,
  (SELECT COUNT(*) FROM \"Teacher\") as teacher_count,
  (SELECT COUNT(*) FROM \"Students\") as student_count,
  (SELECT COUNT(*) FROM \"Zone\") as zone_count,
  (SELECT COUNT(*) FROM \"Camara\") as camera_count,
  (SELECT COUNT(*) FROM \"AttendanceLog\") as attendance_count;
"

# Test 3: Show admins
echo "=== Admin Users ==="
npx prisma db execute --stdin <<< 'SELECT "Admin_ID", "Name", "Email", "Role" FROM "Admin";'

# Test 4: Show teachers
echo "=== Teachers ==="
npx prisma db execute --stdin <<< 'SELECT "Teacher_ID", "Name", "Email" FROM "Teacher";'

# Test 5: Show zones
echo "=== Zones ==="
npx prisma db execute --stdin <<< 'SELECT "Zone_id", "Zone_Name" FROM "Zone";'
```

---

## 🌐 Fetch Data via Frontend Dashboard

1. **Open**: http://localhost:3001
2. **Login**:
   - Email: `superadmin@intellisight.com`
   - Password: `SuperAdmin@123`
3. **Navigate**:
   - **Students Page** - Shows all students from database
   - **Teachers Page** - Shows all teachers from database
   - **Zones Page** - Shows all zones from database
   - **Zone 1** - Shows real-time presence data

---

## 🔧 Troubleshooting Connection Issues

### Problem 1: "Connection refused"
**Cause**: PostgreSQL not running on port 5000

**Solution**:
```bash
# Check if PostgreSQL is running
sudo service postgresql status

# Check if port 5000 is listening
netstat -an | grep 5000
# OR
ss -tlnp | grep 5000
```

### Problem 2: "Password authentication failed"
**Cause**: Wrong password or user doesn't exist

**Solution**:
```bash
# On Windows, reset PostgreSQL password
# 1. Open SQL Shell (psql) as Administrator
# 2. Run: ALTER USER postgres WITH PASSWORD 'ozair';
```

### Problem 3: "Database FYP_Intellisight does not exist"
**Cause**: Database not created

**Solution**:
```bash
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP

# Create database with Prisma
npx prisma db push

# OR run migrations
npx prisma migrate deploy

# Seed data
npm run seed
```

### Problem 4: Backend says "Database connected" but no data
**Cause**: Database exists but tables are empty

**Solution**:
```bash
# Check if tables have data
npx prisma db execute --stdin <<< 'SELECT COUNT(*) FROM "Teacher";'

# If count is 0, seed the database
npm run seed
```

---

## 📊 Database Structure Overview

Your PostgreSQL database has these main tables:

```
┌─────────────────────┐
│  Admin              │  - Admin users (3 seeded)
├─────────────────────┤
│  Teacher            │  - Teachers (5 seeded, 1 with images)
├─────────────────────┤
│  Students           │  - Students (8 seeded)
├─────────────────────┤
│  Zone               │  - Physical zones (5 seeded)
├─────────────────────┤
│  Camara             │  - Cameras (multiple per zone)
├─────────────────────┤
│  AttendanceLog      │  - Entry/exit logs
├─────────────────────┤
│  ActivePresence     │  - Current persons in zones
├─────────────────────┤
│  ProcessedFaceImages│  - Face images for ML
├─────────────────────┤
│  FaceEmbeddings     │  - Face recognition data
└─────────────────────┘
```

---

## 🚀 Quick Data Verification

### From Windows Command Prompt:
```cmd
psql -h localhost -p 5000 -U postgres -d FYP_Intellisight -c "SELECT * FROM \"Admin\";"
```

### From WSL:
```bash
curl http://localhost:3000/api/health | python3 -m json.tool
```

### From Browser:
```
http://localhost:3001
```

---

## 💡 Important Notes

1. **Port 5000**: Your PostgreSQL is running on port 5000, NOT the default 5432
2. **Connection Works**: Your backend is successfully connected (shown by health check)
3. **Data Exists**: You have:
   - 3 Admin users
   - 1 Teacher (Abdullah) with face images
   - 5 Zones
   - Various other records

4. **Access Points**:
   - **WSL → Windows**: Works via `127.0.0.1:5000`
   - **Windows → Windows**: Works via `localhost:5000`
   - **Backend → Database**: ✅ Connected
   - **GPU Service → Database**: ✅ Connected

---

## 📝 Example Queries You Can Run

```sql
-- Get all teachers with their zone information
SELECT 
    t."Teacher_ID",
    t."Name",
    t."Email",
    z."Zone_Name"
FROM "Teacher" t
LEFT JOIN "Zone" z ON t."Zone_id" = z."Zone_id";

-- Get attendance logs from today
SELECT 
    "AttendanceLog_ID",
    "person_type",
    "person_id",
    "entry_time",
    "Zone_id"
FROM "AttendanceLog"
WHERE DATE("entry_time") = CURRENT_DATE
ORDER BY "entry_time" DESC;

-- Get current active persons in all zones
SELECT 
    "person_type",
    "person_id",
    "Zone_id",
    "entry_time"
FROM "ActivePresence"
ORDER BY "entry_time" DESC;

-- Count records in all tables
SELECT 
    (SELECT COUNT(*) FROM "Admin") as admins,
    (SELECT COUNT(*) FROM "Teacher") as teachers,
    (SELECT COUNT(*) FROM "Students") as students,
    (SELECT COUNT(*) FROM "Zone") as zones,
    (SELECT COUNT(*) FROM "AttendanceLog") as logs;
```

---

## ✅ Your Current Status

```
✅ PostgreSQL is running on Windows (port 5000)
✅ Backend is connected to database
✅ Frontend can access backend API
✅ GPU service can log to database
✅ Data exists in database (3 admins, 1 teacher, 5 zones)
```

**Your system IS connected and working!**

If you're not seeing data in the frontend, the issue might be with the frontend API calls, not the database connection.
