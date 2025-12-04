# Face Recognition System - Quick Reference Guide

## 🚀 Quick Start (3 Steps)

### Step 1: Train Face Encodings
```bash
cd face-recognition
python train_from_database.py --type all
```
✅ **Status**: Already completed (1 student + 1 teacher trained)

### Step 2: Run Detection System
```bash
# Single camera (Entry only)
python camera_detection_system.py --zone 1 --entry-camera 0

# Dual cameras (Entry + Exit)
python camera_detection_system.py --zone 1 --entry-camera 0 --exit-camera 1
```

### Step 3: Verify Records
```bash
python verify_person_records.py
```

---

## 📊 What Happens When Person is Detected

### Entry Camera Detection:
```
Face Detected → Recognized → Create 3 Database Entries:
1. ActivePresence (currently in zone)
2. AttendanceLog (entry time logged)
3. Logs (person record created)
```

### Exit Camera Detection:
```
Face Detected → Recognized → Update/Delete:
1. ActivePresence (delete - person left)
2. AttendanceLog (add exit time & duration)
3. Logs (add exit time)
```

---

## 📋 Database Tables

| Table | Purpose | Created On | Updated On |
|-------|---------|------------|------------|
| **Logs** | Individual person records | Entry | Exit |
| **AttendanceLog** | Entry/exit history | Entry | Exit |
| **ActivePresence** | Current occupancy | Entry | Deleted on Exit |
| **UnknownFaces** | Unknown detections | Unknown face | - |

---

## 🔍 View Records Commands

```bash
# View everything
python verify_person_records.py

# View only active persons
python verify_person_records.py --active-only

# View only person logs
python verify_person_records.py --logs-only

# View only attendance logs
python verify_person_records.py --attendance-only

# View specific person history
python verify_person_records.py --person-type student --person-id 1
python verify_person_records.py --person-type teacher --person-id 1

# Limit number of records shown
python verify_person_records.py --limit 50
```

---

## 📝 Console Output Example

### Entry Detection:
```
✅ ENTRY: Student 1 → Zone 1
   ├─ ActivePresence ID: 1
   ├─ AttendanceLog ID: 1
   └─ Logs Entry ID: 1
```

### Exit Detection:
```
🚪 EXIT: Student 1 ← Zone 1
   ├─ Duration: 15 minutes
   ├─ AttendanceLog ID: 1
   └─ Logs Exit ID: 1
```

---

## 🎛️ Camera Controls (During Detection)

| Key | Action |
|-----|--------|
| `q` | Quit application |
| `e` | Show Entry camera only |
| `x` | Show Exit camera only |
| `b` | Show Both cameras side-by-side |

---

## 🔧 Configuration (.env file)

```dotenv
# Database
DB_HOST=localhost
DB_PORT=5000
DB_NAME=FYP_Intellisight
DB_USER=postgres
DB_PASSWORD=ozair

# Recognition
RECOGNITION_TOLERANCE=0.5
FACE_DETECTION_MODEL=hog

# Camera
CAMERA_SOURCE=0           # 0 for webcam, URL for IP camera
EXIT_CAMERA_SOURCE=1      # Optional exit camera
```

---

## 🗄️ SQL Queries for Records

### Get all detections today:
```sql
SELECT * FROM "Logs" 
WHERE DATE("EntryTime") = CURRENT_DATE 
ORDER BY "EntryTime" DESC;
```

### Get specific person's history:
```sql
SELECT * FROM "Logs" 
WHERE "Student_ID" = 1 
ORDER BY "EntryTime" DESC;
```

### Get currently active persons:
```sql
SELECT * FROM "ActivePresence" 
ORDER BY "EntryTime" DESC;
```

### Get attendance with durations:
```sql
SELECT * FROM "AttendanceLog" 
WHERE "ExitTime" IS NOT NULL 
ORDER BY "EntryTime" DESC;
```

---

## ✅ Verification Checklist

Before running detection system:
- [x] Database connected ✅
- [x] Face encodings trained ✅
- [x] Backend API running (port 3000)
- [x] Frontend dashboard running (port 3001)
- [ ] Camera connected and working
- [ ] Good lighting in detection area

---

## 🎯 Expected Results

### After Entry Detection:
| Table | Count | Status |
|-------|-------|--------|
| Logs | +1 | EntryTime set, ExitTime NULL |
| AttendanceLog | +1 | EntryTime set, ExitTime NULL |
| ActivePresence | +1 | Person added to zone |

### After Exit Detection:
| Table | Count | Status |
|-------|-------|--------|
| Logs | Same | ExitTime updated |
| AttendanceLog | Same | ExitTime & Duration updated |
| ActivePresence | -1 | Person removed from zone |

---

## 📞 Troubleshooting

### "No face detected"
- Check lighting
- Move closer to camera
- Ensure face is visible and looking at camera

### "Person already in zone"
- Normal - system prevents duplicate entries
- Wait for cooldown period (5 seconds)

### "Database connection failed"
- Check PostgreSQL is running
- Verify .env credentials
- Test: `psql -U postgres -d FYP_Intellisight`

### "Camera not found"
- Check camera is connected
- Try different camera index (0, 1, 2)
- Test: `python -c "import cv2; print(cv2.VideoCapture(0).isOpened())"`

---

## 📊 Current System Status

✅ **Ready for Testing**

- Students in database: 1
- Teachers in database: 1
- Face encodings: Trained
- Detection system: Ready
- Verification tools: Ready
- Backend integration: Complete

**Next step**: Run camera detection system and test with live cameras! 🎥
