# Entry/Exit Camera System Guide

## Overview
The face recognition system uses **Entry Camera** and optional **Exit Camera** to track people entering and exiting Zone 1.

## Database Tables

### 1. **ActivePresence**
- Stores people **currently in the zone**
- Created when Entry camera detects someone
- Deleted when Exit camera detects them leaving
- Fields: `Presence_ID`, `Zone_id`, `Student_ID`/`Teacher_ID`, `PersonType`, `EntryTime`

### 2. **AttendanceLog**
- Historical record of all entries/exits
- Created when Entry camera detects someone (ExitTime = NULL)
- Updated when Exit camera detects them (ExitTime set, Duration calculated)
- Fields: `Log_ID`, `Zone_id`, `Student_ID`/`Teacher_ID`, `PersonType`, `EntryTime`, `ExitTime`, `Duration`

### 3. **Logs**
- Individual person detection records
- Created when Entry camera detects someone (ExitTime = NULL)
- Updated when Exit camera detects them (ExitTime set)
- Fields: `Logs_ID`, `Zone_id`, `Student_ID`/`Teacher_ID`, `PersonType`, `EntryTime`, `ExitTime`

## Camera Workflow

### Entry Camera Detection
When a person is detected by the **Entry camera**:

1. **Check if already in zone** (query ActivePresence)
   - If YES → Skip (log message: "already in zone")
   - If NO → Continue to step 2

2. **Create 3 database records:**
   ```sql
   -- ActivePresence: Mark as currently in zone
   INSERT INTO ActivePresence (Zone_id, Student_ID/Teacher_ID, PersonType, EntryTime)
   
   -- AttendanceLog: Create entry record with NULL ExitTime
   INSERT INTO AttendanceLog (Zone_id, Student_ID/Teacher_ID, PersonType, EntryTime, ExitTime, Duration)
   VALUES (..., NULL, NULL)
   
   -- Logs: Create detection record with NULL ExitTime
   INSERT INTO Logs (Zone_id, Student_ID/Teacher_ID, PersonType, EntryTime, ExitTime)
   VALUES (..., NULL)
   ```

3. **Console output:**
   ```
   ✅ ENTRY: Student 1 → Zone 1
      ├─ ActivePresence ID: 123
      ├─ AttendanceLog ID: 456
      └─ Logs Entry ID: 789
   ```

4. **Cooldown:** 5 seconds before same person can be detected again

### Exit Camera Detection
When a person is detected by the **Exit camera**:

1. **Check if in zone** (query ActivePresence)
   - If NO → Skip (log message: "not in zone")
   - If YES → Continue to step 2

2. **Update 2 database records + Delete ActivePresence:**
   ```sql
   -- AttendanceLog: Update with exit time and duration
   UPDATE AttendanceLog 
   SET ExitTime = NOW(), Duration = MINUTES_BETWEEN(EntryTime, NOW())
   WHERE Student_ID/Teacher_ID = X AND ExitTime IS NULL
   
   -- Logs: Update with exit time
   UPDATE Logs
   SET ExitTime = NOW()
   WHERE Student_ID/Teacher_ID = X AND ExitTime IS NULL
   
   -- ActivePresence: Remove from zone
   DELETE FROM ActivePresence WHERE Presence_ID = X
   ```

3. **Console output:**
   ```
   🚪 EXIT: Student 1 ← Zone 1
      ├─ Duration: 45 minutes
      ├─ AttendanceLog ID: 456
      └─ Logs Exit ID: 789
   ```

## Running the System

### Entry Camera Only (Recommended for Testing)
```bash
cd face-recognition
python camera_detection_system.py
```

This will:
- Use webcam (camera 0) as Entry camera
- No Exit camera
- Record entries to database
- Skip duplicates automatically

### Entry + Exit Cameras (Dual Camera Setup)
```bash
cd face-recognition
python camera_detection_system.py --exit-camera 1
```

This will:
- Use camera 0 as Entry camera
- Use camera 1 as Exit camera
- Record entries and exits

### Command Line Options
```bash
--zone 1                    # Zone ID (default: 1)
--entry-camera 0           # Entry camera source (default: 0 = webcam)
--exit-camera 1            # Exit camera source (optional)
--backend http://...       # Backend API URL
--no-deepface              # Disable DeepFace (use face_recognition only)
```

## Viewing Data on Website

### 1. **Active Presence (Currently in Zone)**
API: `GET /api/zones/1/current`

Shows people currently inside the zone:
- Name, Photo
- Entry Time
- Duration inside
- Status: "Inside"

### 2. **Attendance Logs (Entry/Exit History)**
API: `GET /api/zones/1/timetable-logs`

Shows all entry/exit records:
- Name, Photo
- Entry Time
- Exit Time (NULL if still inside)
- Duration (NULL if still inside)
- Status: "Inside" or "Completed"

### 3. **Zone Logs (All Detections)**
API: `GET /api/zones/1/logs`

Same as Attendance Logs (both use AttendanceLog table)

## Verifying Database Records

### Check all tables:
```bash
cd face-recognition
python verify_person_records.py
```

Output:
```
============================================================
          📊 PERSON RECORDS VERIFICATION
============================================================

📈 STATISTICS
┌──────────────────────┬────────┐
│ Metric               │ Count  │
├──────────────────────┼────────┤
│ Active in Zone       │ 2      │
│ Attendance Logs      │ 5      │
│ Person Logs          │ 5      │
│ Unknown Faces        │ 7      │
└──────────────────────┴────────┘

👥 ACTIVE PRESENCE (Currently in Zone)
┌──────────┬──────────┬────────────────┬──────────────────────┐
│ Type     │ ID       │ Zone           │ Entry Time           │
├──────────┼──────────┼────────────────┼──────────────────────┤
│ Student  │ 1        │ 1              │ 2025-12-04 10:30:00  │
└──────────┴──────────┴────────────────┴──────────────────────┘
```

### Check specific person:
```bash
python verify_person_records.py --person-type student --person-id 1
```

## Troubleshooting

### Issue: Camera detects but no database records
**Symptoms:** Green box appears, name shown, but database empty

**Solution:**
1. Check console for "✅ ENTRY" messages
2. If you see "⏭️ already in zone", person is already in ActivePresence
3. Clear ActivePresence table: `DELETE FROM "ActivePresence";`
4. Re-run camera system

### Issue: Person always shows "already in zone"
**Cause:** Person wasn't properly marked as exited

**Solution:**
```sql
-- Clear active presence for specific person
DELETE FROM "ActivePresence" 
WHERE "Student_ID" = 1 AND "Zone_id" = 1;

-- Or clear all active presence
DELETE FROM "ActivePresence";
```

### Issue: No green box or name appearing
**Cause:** Face not trained or not recognized

**Solution:**
```bash
cd face-recognition
python train_from_database.py
```

Check output for successful training:
```
✅ Training complete!
   Students trained: 1 (4 encodings)
   Teachers trained: 1 (4 encodings)
```

## Detection Logic

### Visual Feedback (Continuous)
- Green box + name appears on **every frame** when face is recognized
- This is just visual feedback, not database recording

### Database Recording (Once per Cooldown)
- Database only records **once every 5 seconds** per person
- If person already in ActivePresence, skips recording (returns False)
- This prevents duplicate entries

### Example Timeline:
```
00:00 - Person appears → Green box shows
00:01 - ✅ ENTRY: Database record created (ActivePresence, AttendanceLog, Logs)
00:02 - Green box shows (no database action - cooldown)
00:03 - Green box shows (no database action - cooldown)
00:04 - Green box shows (no database action - cooldown)
00:05 - Green box shows (no database action - cooldown)
00:06 - Green box shows → Check database
        ⏭️ Already in zone (ActivePresence exists) → Skip
00:07+ - Green box continues showing (no database action)
```

## Backend API Integration

### Entry Detection
```javascript
POST /api/zones/1/recognize
{
  "personId": 1,
  "personType": "Student",
  "cameraType": "Entry",
  "confidence": 0.95
}
```

Response:
```json
{
  "success": true,
  "message": "Person entry logged successfully",
  "data": {
    "Presence_ID": 123,
    "Zone_id": 1,
    "Student_ID": 1,
    "EntryTime": "2025-12-04T10:30:00.000Z"
  }
}
```

### Exit Detection
```javascript
POST /api/zones/1/recognize
{
  "personId": 1,
  "personType": "Student",
  "cameraType": "Exit",
  "confidence": 0.95
}
```

Response:
```json
{
  "success": true,
  "message": "Person exit logged successfully",
  "duration": 45
}
```

## Summary

✅ **Entry Camera** → Creates records in ActivePresence, AttendanceLog (ExitTime=NULL), Logs (ExitTime=NULL)

✅ **Exit Camera** → Updates AttendanceLog & Logs with ExitTime, Deletes from ActivePresence

✅ **Website** → Displays data from AttendanceLog and ActivePresence tables

✅ **Cooldown** → 5 seconds between detections to prevent duplicates

✅ **Duplicate Check** → Skips if person already in ActivePresence
