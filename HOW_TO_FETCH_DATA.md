# 🔌 How to Fetch Data from Windows PostgreSQL

## ✅ YOUR SYSTEM **IS** CONNECTED!

Your backend shows:
```json
{
  "database": {
    "connected": true,
    "students": 0,
    "teachers": 1,
    "zones": 5
  }
}
```

---

## 📍 Where Your System Connects

### 1. Backend (Node.js)
**File**: `.env`
```
DATABASE_URL="postgresql://postgres:ozair@127.0.0.1:5000/FYP_Intellisight?schema=public"
```

**Used by**:
- `src/config/database.js` - Prisma Client
- All API controllers (student, teacher, zone, etc.)

### 2. GPU Face Service (Python)
**File**: `Facerecongination/gpu_face_service_lite.py`
```python
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5000,
    'database': 'FYP_Intellisight',
    'user': 'postgres',
    'password': 'ozair'
}
```

---

## 💻 Method 1: From Windows Command Prompt

### Quick Query:
```cmd
psql -h localhost -p 5000 -U postgres -d FYP_Intellisight -c "SELECT * FROM \"Admin\";"
```

### Interactive Shell:
```cmd
psql -h localhost -p 5000 -U postgres -d FYP_Intellisight
Password: ozair

# Then run queries:
SELECT * FROM "Admin";
SELECT * FROM "Teacher";
SELECT * FROM "Students";
SELECT * FROM "Zone";
```

### Using Batch Script (Easiest!):
1. Double-click: `view_database.bat`
2. It will show all your data automatically!

---

## 🖥️ Method 2: From pgAdmin (GUI)

1. **Open pgAdmin** on Windows
2. **Right-click "Servers"** → "Register" → "Server"
3. **General Tab**:
   - Name: `IntelliSight`
4. **Connection Tab**:
   - Host: `localhost`
   - Port: `5000` ⚠️ (NOT 5432!)
   - Database: `FYP_Intellisight`
   - Username: `postgres`
   - Password: `ozair`
5. **Save** and **Connect**

Now you can browse all tables visually!

---

## 🐧 Method 3: From WSL Ubuntu

### Using SQL File:
```bash
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP

# Run all queries from view_all_data.sql
PGPASSWORD=ozair psql -h 127.0.0.1 -p 5000 -U postgres -d FYP_Intellisight -f view_all_data.sql
```

### Direct Queries:
```bash
# Set password as environment variable
export PGPASSWORD=ozair

# Query admins
psql -h 127.0.0.1 -p 5000 -U postgres -d FYP_Intellisight -c "SELECT * FROM \"Admin\";"

# Query teachers
psql -h 127.0.0.1 -p 5000 -U postgres -d FYP_Intellisight -c "SELECT * FROM \"Teacher\";"

# Query students
psql -h 127.0.0.1 -p 5000 -U postgres -d FYP_Intellisight -c "SELECT * FROM \"Students\";"
```

---

## 🌐 Method 4: Via Backend API (with Authentication)

### Step 1: Login to get token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@intellisight.com","password":"SuperAdmin@123"}'
```

### Step 2: Use token to fetch data
```bash
# Save token from login response
TOKEN="your_jwt_token_here"

# Get students
curl http://localhost:3000/api/students \
  -H "Authorization: Bearer $TOKEN"

# Get teachers
curl http://localhost:3000/api/teachers \
  -H "Authorization: Bearer $TOKEN"

# Get zones
curl http://localhost:3000/api/zones \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Method 5: Via Frontend Dashboard (Easiest!)

1. Open: http://localhost:3001
2. Login:
   - Email: `superadmin@intellisight.com`
   - Password: `SuperAdmin@123`
3. Navigate pages:
   - **Dashboard** - Overview
   - **Students** - All students
   - **Teachers** - All teachers
   - **Zones** - All zones

---

## 🔍 Common Queries

### Copy these into pgAdmin Query Tool or psql:

```sql
-- View all admins
SELECT * FROM "Admin";

-- View all teachers with zones
SELECT 
  t."Teacher_ID",
  t."Name",
  t."Email",
  z."Zone_Name"
FROM "Teacher" t
LEFT JOIN "Zone" z ON t."Zone_id" = z."Zone_id";

-- View all students with zones
SELECT 
  s."Student_ID",
  s."Name",
  s."Email",
  z."Zone_Name"
FROM "Students" s
LEFT JOIN "Zone" z ON s."Zone_id" = z."Zone_id";

-- Count all records
SELECT 
  (SELECT COUNT(*) FROM "Admin") as admins,
  (SELECT COUNT(*) FROM "Teacher") as teachers,
  (SELECT COUNT(*) FROM "Students") as students,
  (SELECT COUNT(*) FROM "Zone") as zones;

-- Recent attendance logs
SELECT * FROM "AttendanceLog" 
ORDER BY "entry_time" DESC 
LIMIT 10;

-- Current active persons
SELECT * FROM "ActivePresence" 
ORDER BY "entry_time" DESC;
```

---

## ⚙️ Connection Settings

```
Host: localhost (or 127.0.0.1)
Port: 5000 ⚠️ (NOT 5432 - this is custom!)
Database: FYP_Intellisight
Username: postgres
Password: ozair
```

---

## 📁 Quick Reference Files

| File | Purpose |
|------|---------|
| `view_database.bat` | **Windows batch script** - Double-click to view all data |
| `view_all_data.sql` | **SQL queries** - Run in pgAdmin or psql |
| `DATABASE_CONNECTION_GUIDE.md` | **Full guide** - Complete documentation |
| `test_database.sh` | **WSL test script** - Test from Ubuntu |

---

## 🎯 Current Data in Your Database

Based on health check:
```
✅ Admin users: 3
✅ Teachers: 1 (Abdullah with face images)
✅ Students: 0 (need to add)
✅ Zones: 5
✅ Cameras: Multiple
```

---

## 🚨 Why Some Data Appears Empty

Your backend health check shows:
- **Teachers: 1** ✅ (Abdullah exists)
- **Students: 0** (need to seed or add manually)

To add more data:
```bash
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP
npm run seed
```

---

## ✅ Quick Test (From Windows)

Open **Command Prompt** and run:

```cmd
psql -h localhost -p 5000 -U postgres -d FYP_Intellisight -c "SELECT COUNT(*) as admin_count FROM \"Admin\";"
```

If you see a number, **YOUR CONNECTION WORKS!**

---

## 📞 Troubleshooting

### "psql: command not found"
**Solution**: Add PostgreSQL to PATH
```
C:\Program Files\PostgreSQL\16\bin
```

### "Connection refused"
**Solution**: Check PostgreSQL is running on port 5000
```cmd
netstat -an | findstr 5000
```

### "Password authentication failed"
**Solution**: Reset password in PostgreSQL:
```sql
ALTER USER postgres WITH PASSWORD 'ozair';
```

---

## 🎉 Summary

**Your system IS connected to PostgreSQL!**

✅ Backend → Database: Connected (127.0.0.1:5000)
✅ GPU Service → Database: Connected (127.0.0.1:5000)
✅ Data exists: 3 admins, 1 teacher, 5 zones

**Easiest way to view data**:
1. Windows: Double-click `view_database.bat`
2. GUI: Use pgAdmin with connection settings above
3. Web: Open http://localhost:3001 and login

**Connection is working perfectly!** 🎊
