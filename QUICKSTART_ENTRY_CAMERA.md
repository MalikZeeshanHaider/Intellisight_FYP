# Quick Start Guide - Entry Camera System

## 🚀 Quick Start (Entry Camera Only)

### 1. Start the Camera Detection System
```bash
cd face-recognition
python camera_detection_system.py
```

**What happens:**
- Opens webcam (camera 0) as Entry camera
- Detects faces in real-time
- When recognized person appears:
  - Shows green box with name
  - Creates database records (after 5 second cooldown)
  - Logs to console: `✅ ENTRY: Student 1 → Zone 1`

### 2. View Data on Website
Open browser: `http://localhost:3001/zone1`

**You'll see:**
- **Active Presence**: People currently in zone
- **Attendance Logs**: All entry/exit history
- **Live Camera Feed**: Real-time detection

### 3. Check Database Records
```bash
cd face-recognition
python verify_person_records.py
```

**Output shows:**
```
📊 STATISTICS
Active in Zone: 2
Attendance Logs: 5
Person Logs: 5

👥 ACTIVE PRESENCE (Currently in Zone)
Student 1 - Zone 1 - Entry: 2025-12-04 10:30:00
```

## 🔄 Testing Workflow

### First Run (Fresh Start)
```bash
# 1. Clear old data
cd face-recognition
python clear_active_presence.py

# 2. Start camera
python camera_detection_system.py

# 3. Stand in front of camera
# Wait for green box + name to appear
# Check console for: ✅ ENTRY: Student X → Zone 1

# 4. Verify database
python verify_person_records.py
```

### Expected Behavior

#### First Detection (0-5 seconds)
```
Console: 🎯 Recognized: Student 1 - Abdullah Uzair (0.85)
         ✅ ENTRY: Student 1 → Zone 1
            ├─ ActivePresence ID: 1
            ├─ AttendanceLog ID: 1
            └─ Logs Entry ID: 1

Database:
- ActivePresence: 1 record (Student 1)
- AttendanceLog: 1 record (EntryTime set, ExitTime NULL)
- Logs: 1 record (EntryTime set, ExitTime NULL)

Visual: Green box with "Abdullah Uzair (85.0%)"
```

#### Subsequent Detections (After 5 seconds)
```
Console: 🎯 Recognized: Student 1 - Abdullah Uzair (0.85)
         ⏭️ Student 1 already in zone - skipping

Database: No changes (same 1 record)

Visual: Green box continues showing
```

## 🐛 Troubleshooting

### Problem: Green box shows but no database records

**Check 1: Console Messages**
```bash
# If you see:
⏭️ Student 1 already in zone - skipping

# Solution: Clear active presence
python clear_active_presence.py
```

**Check 2: Database Verification**
```bash
python verify_person_records.py

# If "Active in Zone: 1" but you want to re-test
# Clear and try again
python clear_active_presence.py
```

### Problem: No green box or name appearing

**Cause:** Face not trained or low confidence

**Solution:**
```bash
# Re-train faces
python train_from_database.py

# Check output:
✅ Training complete!
   Students trained: 1 (4 encodings)
   Teachers trained: 1 (4 encodings)
```

### Problem: Camera won't open

**Solutions:**
```bash
# Check camera is not in use by another program
# Try different camera index:
python camera_detection_system.py --entry-camera 1

# List available cameras:
python -c "import cv2; print([cv2.VideoCapture(i).isOpened() for i in range(4)])"
```

## 📊 Understanding the Data Flow

```
Entry Camera Detects Person
         ↓
  Check ActivePresence
         ↓
    Person exists? ──YES──→ Skip (already in zone)
         ↓
        NO
         ↓
Create 3 Database Records:
  1. ActivePresence (marks as "in zone")
  2. AttendanceLog (EntryTime, ExitTime=NULL)
  3. Logs (EntryTime, ExitTime=NULL)
         ↓
  Send to Backend API
         ↓
Website displays updated data
```

## 🎯 Testing Checklist

- [ ] Backend server running (port 3000)
- [ ] Frontend running (port 3001)
- [ ] PostgreSQL database running
- [ ] Face encodings trained (at least 1 person)
- [ ] Camera accessible
- [ ] Python dependencies installed

### Start All Services

**Terminal 1: Backend**
```bash
cd e:/FYP/Intellisight_FYP/a/Intellisight_FYP
npm start
```

**Terminal 2: Frontend**
```bash
cd admin-dashboard
npm start
```

**Terminal 3: Camera Detection**
```bash
cd face-recognition
python camera_detection_system.py
```

**Terminal 4: Monitoring**
```bash
cd face-recognition
watch -n 5 python verify_person_records.py
```

## 📝 Common Commands

### Clear test data
```bash
python clear_active_presence.py
```

### Verify database
```bash
python verify_person_records.py
```

### Train faces
```bash
python train_from_database.py
```

### Check specific person
```bash
python verify_person_records.py --person-type student --person-id 1
```

### Run with exit camera
```bash
python camera_detection_system.py --exit-camera 1
```

## 🎬 Video Demo Workflow

1. **Setup**: All services running, database clear
2. **Action**: Stand in front of camera
3. **Observe**:
   - Green box appears with name
   - Console shows: `✅ ENTRY: Student 1 → Zone 1`
   - Website updates with Active Presence
4. **Verify**: Run `python verify_person_records.py`
5. **Result**: See 1 active presence, 1 attendance log

## 🔥 Quick Reset (Start Fresh)

```bash
# Stop camera (Ctrl+C)

# Clear data
python clear_active_presence.py

# Restart camera
python camera_detection_system.py
```

## ✅ Success Indicators

**Camera Working:**
- Window opens showing live feed
- Console: `🎬 Initializing Camera Detection System`
- Console: `👥 Loaded 2 known faces`

**Face Detection Working:**
- Red box appears around face
- Console: `🎯 Recognized: Student 1 - Name (0.85)`

**Database Recording Working:**
- Console: `✅ ENTRY: Student 1 → Zone 1`
- Console shows 3 IDs (ActivePresence, AttendanceLog, Logs)
- `verify_person_records.py` shows records

**Website Working:**
- Active Presence shows person
- Attendance Logs shows entry record
- Live camera feed displays

## 📞 Support

If issues persist:
1. Check all terminals for error messages
2. Verify database connection: `psql -U postgres -d intellisight`
3. Check Python logs in console
4. Verify backend API: `http://localhost:3000/api/zones/1/current`
