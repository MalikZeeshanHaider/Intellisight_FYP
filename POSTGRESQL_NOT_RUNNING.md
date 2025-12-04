# ⚠️ ISSUE FOUND: PostgreSQL Not Running

## Problem
Camera detects face (green box shows) but NO database updates because:
**PostgreSQL database service is not running!**

## Solution: Start PostgreSQL

### Method 1: Windows Services (Recommended)
```powershell
# Open PowerShell as Administrator and run:
net start postgresql-x64-15
# OR
net start postgresql
```

### Method 2: pgAdmin
1. Open **pgAdmin 4**
2. Right-click on PostgreSQL server
3. Click **"Start Server"**

### Method 3: Services.msc
1. Press `Win + R`
2. Type `services.msc`
3. Find **PostgreSQL** service
4. Right-click → **Start**

## Verify PostgreSQL is Running

```bash
cd face-recognition
python test_db_connection.py
```

**Expected output:**
```
============================================================
DATABASE CONNECTION TEST
============================================================

1. Testing connection...
   ✓ SUCCESS: Connected to database

2. Testing query execution...
   ✓ SUCCESS: PostgreSQL version: ...

3. Checking required tables...
   - ActivePresence: 0 records
   - AttendanceLog: 2 records
   - Logs: 2 records
   - Students: 1 records
   - Teacher: 1 records

4. Checking trained faces...
   - Students with embeddings: 1
   - Teachers with embeddings: 1

ALL TESTS PASSED!
Database is ready for face recognition system.
```

## After Starting PostgreSQL

### 1. Clear old active presence (optional)
```bash
python clear_active_presence.py
```

### 2. Start camera detection
```bash
python camera_detection_system.py
```

### 3. Watch for console output
When your face is detected:
```
🎯 Recognized: Student 1 - Your Name (0.85)
🔄 Attempting to record Entry for Student 1
📝 record_entry called: Student 1
🔍 Checking ActivePresence for Student 1
✅ Person not in zone, creating entry records...
✅ ENTRY: Student 1 → Zone 1
   ├─ ActivePresence ID: 123
   ├─ AttendanceLog ID: 456
   └─ Logs Entry ID: 789
```

### 4. Verify database
```bash
python verify_person_records.py
```

Should show:
```
📊 STATISTICS
Active in Zone: 1
Attendance Logs: 1
Person Logs: 1
```

## Common PostgreSQL Issues

### Issue: Port 5432 already in use
```bash
# Check what's using the port
netstat -ano | findstr :5432

# If it's a different PostgreSQL instance, change config
# Or stop the other instance
```

### Issue: PostgreSQL service not found
```powershell
# List all PostgreSQL services
Get-Service | Where-Object {$_.Name -like "*postgres*"}

# Start the correct one
Start-Service <service-name>
```

### Issue: Permission denied
```
Run PowerShell as Administrator
```

## Quick Diagnosis Script

```bash
# Run this to check everything:
python test_db_connection.py

# If it fails:
# 1. Start PostgreSQL
# 2. Run again
# 3. If still fails, check credentials in config.py
```

## Summary

✅ **Step 1:** Start PostgreSQL service
✅ **Step 2:** Run `python test_db_connection.py` (should pass)
✅ **Step 3:** Run `python camera_detection_system.py`
✅ **Step 4:** Your face detected → Database updated automatically

The camera detection IS working (you see green box + name).
The database recording WAS failing silently (no PostgreSQL connection).
Now with debug logging, you'll see clear error messages if database is unavailable.
