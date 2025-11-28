# Face Recognition System - Complete Testing Guide

## System Architecture

### Database Tables
1. **Students** - Student records with 5 face pictures + Face_Embeddings
2. **Teacher** - Teacher records with 5 face pictures + Face_Embeddings  
3. **ActivePresence** - Temporary tracking of people currently in zones
4. **AttendanceLog** - Permanent record of entry/exit with timestamps
5. **Camara** - Camera configuration with Entry/Exit types per zone

### Data Flow
```
Person Enters → Entry Camera Detects → 5 Consecutive Matches → Add to ActivePresence
Person Exits → Exit Camera Detects → 5 Consecutive Matches → Remove from ActivePresence + Create AttendanceLog
```

## Step-by-Step Testing Guide

### 1. System Setup

#### Install Python Dependencies
```bash
cd face-recognition
pip install -r requirements.txt
```

#### Verify Installation
```bash
python test_system.py
```

Expected output:
- ✓ OpenCV imported
- ✓ face_recognition imported
- ✓ Database connected
- ✓ Camera accessible
- ✓ Face detection works

### 2. Database Configuration

#### Setup Cameras for Zone 1
```bash
cd ..
node scripts/setupCameras.js
```

This creates:
- Zone 1: Main Building
- Camera 1: Entry (Camera_URL = "0")
- Camera 2: Exit (Camera_URL = "0")

**Note:** In production, use different camera sources:
- Entry: Camera_URL = "0" (first USB camera)
- Exit: Camera_URL = "1" (second USB camera)
- Or use RTSP URLs: "rtsp://username:password@ip:port/stream"

#### Verify Database
```bash
node scripts/checkTeachers.js
```

### 3. Add Test Data via Dashboard

#### Start Backend
```bash
npm start
```

#### Start Frontend
```bash
cd admin-dashboard
npm run dev
```

#### Add Students (http://localhost:3001/students)
1. Click "Add Student" button
2. Fill in details:
   - Name: John Doe
   - Roll Number: 2025001
   - Email: john@example.com
   - Gender: Male
   - Department: Computer Science
3. Upload 5 different face pictures:
   - **Requirements for best accuracy:**
     - Clear, front-facing photos
     - Good lighting
     - No sunglasses/masks
     - Different angles: straight, slight left, slight right, smiling, neutral
     - Minimum 200x200 pixels
     - High quality images
4. Click "Create Student"
5. Repeat for more students (recommend 2-3 for testing)

#### Add Teachers (http://localhost:3001/teachers)
1. Click "Add Teacher"
2. Fill in details:
   - Name: Dr. Smith
   - Email: smith@example.com
   - Gender: Male
   - Faculty Type: Permanent
   - Department: Computer Science (required for Permanent)
3. Upload 5 face pictures (same requirements as students)
4. Click "Create Teacher"
5. Add 1-2 more teachers

### 4. Enroll Face Embeddings

#### Method 1: Via Dashboard (Recommended)
1. Go to Students page
2. Find student "John Doe"
3. Click the **green enrollment icon** (👤 with checkmark)
4. Wait for processing (10-30 seconds per person)
5. Success message appears: "Face enrollment successful for John Doe"
6. Repeat for all students and teachers

#### Method 2: Via Command Line
```bash
cd face-recognition

# Enroll specific student
python enrollment.py --type student --id 1

# Enroll specific teacher
python enrollment.py --type teacher --id 1

# Enroll all at once
python enrollment.py --all
```

#### Verify Embeddings Created
```bash
node scripts/checkTeachers.js
```

Expected output shows Face_Embeddings present for all enrolled persons.

### 5. Configure Recognition Settings

Edit `face-recognition/.env` for your environment:

```env
# Strict accuracy (recommended for testing)
RECOGNITION_TOLERANCE=0.5
MIN_FACE_SIZE=100
CONSECUTIVE_MATCHES=5
FRAME_SKIP=2

# For faster processing (lower accuracy)
RECOGNITION_TOLERANCE=0.6
MIN_FACE_SIZE=80
CONSECUTIVE_MATCHES=3
FRAME_SKIP=5
```

**Tolerance Guide:**
- 0.4 = Very strict (may miss some matches)
- 0.5 = Strict (recommended for secure areas)
- 0.6 = Balanced (default)
- 0.7 = Loose (may have false positives)

### 6. Test Camera Setup

#### Test Individual Camera
```bash
cd face-recognition
python -c "import cv2; cap = cv2.VideoCapture(0); ret, frame = cap.read(); print(f'Camera 0: {'OK' if ret else 'FAIL'}'); cap.release()"
```

#### Test Both Cameras
```bash
# Camera 0 (Entry)
python -c "import cv2; cap = cv2.VideoCapture(0); print('Press Q to close'); 
while True: 
    ret, frame = cap.read()
    if not ret: break
    cv2.imshow('Entry Camera', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): break
cap.release(); cv2.destroyAllWindows()"

# Camera 1 (Exit) - Run in separate terminal
python -c "import cv2; cap = cv2.VideoCapture(1); print('Press Q to close');
while True:
    ret, frame = cap.read()
    if not ret: break
    cv2.imshow('Exit Camera', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): break
cap.release(); cv2.destroyAllWindows()"
```

### 7. Run Face Recognition

#### Start Recognition System
```bash
cd face-recognition
python recognition.py --zone 1
```

#### What You'll See

**Two Windows Open:**
- `Main Building - ENTRY` (Entry camera feed)
- `Main Building - EXIT` (Exit camera feed)

**Detection Indicators:**
- **Green box** = Known person detected at entry
- **Orange box** = Known person detected at exit
- **Red box** = Unknown person
- **Gray box** = Face too small
- **Counter** = Match count (e.g., "John Doe (3/5)")
- **Confidence** = Match confidence (e.g., "Conf: 95%")

**Console Output:**
```
[ENTRY] ✓ John Doe (Student) entered Main Building | Confidence: 96.5%
[EXIT] ✓ John Doe (Student) exited Main Building | Confidence: 94.2%
[UNKNOWN] Unknown face saved: unknown_entry_20251128_143022.jpg
```

### 8. Monitor Active Presence

#### Via Dashboard (http://localhost:3001/active-presence)
- Real-time view of people currently in zones
- Shows: Name, Type, Department, Entry Time, Duration
- Auto-refreshes every 10 seconds
- Filter by zone

#### Via Database Query
```bash
node -e "const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient();
(async () => {
  const active = await prisma.activePresence.findMany({
    include: { student: true, teacher: true, zone: true }
  });
  console.log(JSON.stringify(active, null, 2));
  await prisma.$disconnect();
})();"
```

### 9. View Attendance Logs

#### Via Dashboard (http://localhost:3001/attendance-logs)
- Complete history of entry/exit events
- Filters: Zone, Person Type, Date Range
- Shows: Entry Time, Exit Time, Duration
- Export to CSV

#### Via Database Query
```bash
node -e "const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const logs = await prisma.attendanceLog.findMany({
    include: { student: true, teacher: true, zone: true },
    orderBy: { EntryTime: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(logs, null, 2));
  await prisma.$disconnect();
})();"
```

### 10. Testing Scenarios

#### Scenario 1: Entry Detection
1. Start recognition: `python recognition.py --zone 1`
2. Position enrolled person in front of **Entry camera**
3. Hold steady for 5 frames (~2-3 seconds)
4. Console shows: `[ENTRY] ✓ Name entered...`
5. Check Active Presence dashboard - person appears
6. Check database:
```bash
node -e "const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const count = await prisma.activePresence.count({ where: { Zone_id: 1 } });
  console.log(`Active in Zone 1: ${count}`);
  await prisma.$disconnect();
})();"
```

#### Scenario 2: Exit Detection
1. Keep recognition running
2. Position same person in front of **Exit camera**
3. Hold steady for 5 frames
4. Console shows: `[EXIT] ✓ Name exited... (Duration: X min)`
5. Check Active Presence dashboard - person disappears
6. Check Attendance Logs dashboard - entry appears with duration
7. Verify AttendanceLog created:
```bash
node -e "const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const log = await prisma.attendanceLog.findFirst({
    where: { Zone_id: 1 },
    orderBy: { CreatedAt: 'desc' },
    include: { student: true, teacher: true }
  });
  console.log(JSON.stringify(log, null, 2));
  await prisma.$disconnect();
})();"
```

#### Scenario 3: Unknown Person
1. Position unknown person in front of camera
2. Red box appears: "Unknown"
3. After 5 consecutive frames, face saved to `unidentified_images/`
4. Check UnknownFaces table:
```bash
node -e "const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const unknown = await prisma.unknownFaces.findMany({
    orderBy: { DetectedTime: 'desc' },
    take: 5
  });
  console.log(`Unknown faces: ${unknown.length}`);
  await prisma.$disconnect();
})();"
```

#### Scenario 4: Multiple People
1. Have 2 enrolled persons enter via Entry camera (one at a time)
2. Both should appear in ActivePresence
3. First person exits via Exit camera
4. First person removed from ActivePresence, log created
5. Second person still in ActivePresence
6. Second person exits
7. ActivePresence now empty, both have AttendanceLog entries

### 11. Troubleshooting

#### Problem: "No face detected"
**Solutions:**
- Ensure good lighting
- Move closer to camera
- Remove sunglasses/masks
- Face camera directly
- Check MIN_FACE_SIZE setting

#### Problem: "Low confidence" / Not recognizing
**Solutions:**
- Re-enroll with better quality photos
- Decrease RECOGNITION_TOLERANCE (e.g., 0.6 → 0.55)
- Ensure enrollment photos match camera conditions
- Check if Face_Embeddings exist in database

#### Problem: "Camera not accessible"
**Solutions:**
- Close other apps using camera (Zoom, Skype, etc.)
- Check Camera_URL in database (0, 1, or RTSP)
- Test camera: `python -c "import cv2; print(cv2.VideoCapture(0).isOpened())"`
- Update camera permissions in OS

#### Problem: "Person not entering ActivePresence"
**Solutions:**
- Check console for "Confidence" value
- Ensure 5 consecutive matches (watch counter on screen)
- Verify Zone_id matches in database
- Check if already in ActivePresence (duplicates prevented)

#### Problem: "Exit not working"
**Solutions:**
- Person must be in ActivePresence first
- Verify using correct camera (Exit, not Entry)
- Check Zone_id matches
- Ensure PersonType matches (Student vs Teacher)

### 12. Performance Optimization

#### For Faster Processing
```env
FRAME_SKIP=5  # Process every 5th frame
FACE_DETECTION_MODEL=hog  # Faster CPU detection
```

#### For Better Accuracy
```env
FRAME_SKIP=1  # Process every frame
FACE_DETECTION_MODEL=cnn  # More accurate (requires GPU)
CONSECUTIVE_MATCHES=7  # More confirmation frames
```

### 13. Production Deployment

#### Camera Setup
```sql
-- Update cameras for production
UPDATE "Camara" SET "Camera_URL" = 'rtsp://admin:pass123@192.168.1.100:554/stream' WHERE "Camera_Type" = 'Entry' AND "Zone_id" = 1;
UPDATE "Camara" SET "Camera_URL" = 'rtsp://admin:pass123@192.168.1.101:554/stream' WHERE "Camera_Type" = 'Exit' AND "Zone_id" = 1;
```

#### Run as Service (Linux)
```bash
# Create systemd service
sudo nano /etc/systemd/system/face-recognition.service
```

```ini
[Unit]
Description=Face Recognition Service
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/face-recognition
ExecStart=/usr/bin/python3 recognition.py --zone 1
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable face-recognition
sudo systemctl start face-recognition
sudo systemctl status face-recognition
```

### 14. Success Metrics

Your system is working correctly if:
- ✓ Entry detection adds person to ActivePresence within 3-5 seconds
- ✓ Exit detection removes from ActivePresence and creates AttendanceLog
- ✓ Confidence scores above 90% for enrolled persons
- ✓ No false positives (strangers marked as known persons)
- ✓ Duration calculated correctly (exit time - entry time)
- ✓ Unknown faces properly logged without crashing
- ✓ Multiple people can be tracked simultaneously
- ✓ System runs continuously without memory leaks

## Support Commands

### Clear All Active Presence
```bash
node -e "const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const deleted = await prisma.activePresence.deleteMany({});
  console.log(\`Cleared \${deleted.count} active presence records\`);
  await prisma.$disconnect();
})();"
```

### View Last 10 Attendance Logs
```bash
node -e "const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const logs = await prisma.attendanceLog.findMany({
    include: { student: { select: { Name: true } }, teacher: { select: { Name: true } }, zone: { select: { Zone_Name: true } } },
    orderBy: { EntryTime: 'desc' },
    take: 10
  });
  logs.forEach(l => console.log(\`\${(l.student?.Name || l.teacher?.Name)} in \${l.zone.Zone_Name}: \${l.EntryTime} → \${l.ExitTime} (\${l.Duration} min)\`));
  await prisma.$disconnect();
})();"
```

### Check System Status
```bash
cd face-recognition
python -c "
from database_handler import DatabaseHandler
db = DatabaseHandler()
persons = db.fetch_all_persons()
print(f'Enrolled persons: {len(persons)}')
print(f'Zone 1 name: {db.get_zone_name(1)}')
cameras = db.get_zone_cameras(1)
print(f'Entry camera: {cameras[\"entry\"]
}')
print(f'Exit camera: {cameras[\"exit\"]}')
db.close()
"
```

## Expected Results

After following this guide, you should have:
1. ✅ Students and teachers enrolled with face embeddings
2. ✅ Dual cameras configured for Zone 1
3. ✅ Recognition system running with two camera windows
4. ✅ Entry detection adding to ActivePresence table
5. ✅ Exit detection creating AttendanceLog entries
6. ✅ Dashboard showing real-time active presence
7. ✅ Attendance logs with accurate timestamps and duration
8. ✅ Unknown faces being logged to UnknownFaces table

The system is now production-ready for accurate face detection and attendance tracking!
