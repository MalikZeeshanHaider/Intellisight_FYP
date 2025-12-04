# IntelliSight Face Recognition System - Complete Setup Guide

## Overview
Advanced face recognition system with entry/exit tracking, dual camera support, and real-time database updates.

## Features
✅ **Dual Camera System**: Separate Entry and Exit cameras  
✅ **Real-time Detection**: Face detection and recognition in real-time  
✅ **Database Integration**: Automatic updates to ActivePresence and AttendanceLog  
✅ **Timestamp Tracking**: Entry time, exit time, and duration calculation  
✅ **Multi-person Support**: Students and Teachers tracking  
✅ **Zone-based System**: Multiple zones with independent tracking  
✅ **Unknown Face Logging**: Captures and stores unknown faces  
✅ **DeepFace Integration**: Advanced face recognition (optional)  

---

## System Requirements

### Hardware
- **CPU**: Intel i5 or better (i7+ recommended)
- **RAM**: 8GB minimum (16GB recommended)
- **Camera**: 2x USB webcams or IP cameras (Entry and Exit)
- **GPU** (Optional): NVIDIA GPU for faster processing with DeepFace

### Software
- **Python**: 3.10 or higher
- **PostgreSQL**: 13 or higher
- **Node.js**: 18 or higher (for backend API)
- **Operating System**: Windows 10/11, Linux, or macOS

---

## Installation Steps

### 1. Install System Dependencies

#### Windows
```powershell
# Install Python 3.10+
# Download from: https://www.python.org/downloads/

# Install Visual C++ Build Tools (required for dlib)
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Install CMake
# Download from: https://cmake.org/download/
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y python3.10 python3-pip python3-dev
sudo apt install -y build-essential cmake
sudo apt install -y libopencv-dev
sudo apt install -y postgresql postgresql-contrib
```

#### macOS
```bash
brew install python@3.10
brew install cmake
brew install postgresql
```

### 2. Create Python Virtual Environment

```bash
cd face-recognition

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

### 3. Install Python Dependencies

```bash
# Upgrade pip
pip install --upgrade pip

# Install requirements
pip install -r requirements.txt

# If dlib installation fails on Windows, try:
pip install dlib-binary

# For GPU support (optional):
pip install tensorflow-gpu
```

### 4. Configure Database

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
nano .env  # or use any text editor
```

**.env Configuration:**
```dotenv
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=FYP_Intellisight
DB_USER=postgres
DB_PASSWORD=your_password

# Backend API
BACKEND_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000/api

# Zone Configuration
DEFAULT_ZONE_ID=1

# Camera Settings
CAMERA_SOURCE=0  # Entry camera (0 = first webcam)
EXIT_CAMERA_SOURCE=1  # Exit camera (1 = second webcam, or IP camera URL)

# Recognition Settings
RECOGNITION_TOLERANCE=0.6
DETECTION_METHOD=hog  # Options: hog, cnn (cnn is slower but more accurate)

# Performance
PROCESS_EVERY_N_FRAMES=2
RESIZE_SCALE=0.25
```

### 5. Verify Database Connection

```bash
python -c "from database_handler import DatabaseHandler; db = DatabaseHandler(); print('✅ Database connected')"
```

---

## Usage Guide

### Step 1: Train Face Encodings

Before running the detection system, you must train face encodings from the database.

```bash
# Train all students and teachers
python train_from_database.py --type all

# Train only students
python train_from_database.py --type student

# Train only teachers
python train_from_database.py --type teacher

# Train specific person
python train_from_database.py --type student --id 1
python train_from_database.py --type teacher --id 1
```

**Expected Output:**
```
============================================================
🚀 STARTING COMPLETE TRAINING
============================================================

============================================================
📚 TRAINING ALL STUDENTS
============================================================
Found 10 students to train

[1/10] Processing Student ID: 1
👨‍🎓 Training: Abdullah Uzair (Student ID: 1)
  Processing image 1/5...
  ✅ Image 1 encoded successfully
  Processing image 2/5...
  ✅ Image 2 encoded successfully
  📊 Extracted 2 encodings
  ✅ Trained successfully: Abdullah Uzair

...

============================================================
📊 TRAINING SUMMARY
============================================================
Students: 10/10 successful
Teachers: 5/5 successful
Total Failed: 0
============================================================
```

### Step 2: Run Camera Detection System

#### Single Camera Mode (Entry only)
```bash
python camera_detection_system.py --zone 1 --entry-camera 0
```

#### Dual Camera Mode (Entry + Exit)
```bash
python camera_detection_system.py --zone 1 --entry-camera 0 --exit-camera 1
```

#### With IP Cameras
```bash
python camera_detection_system.py \
  --zone 1 \
  --entry-camera "rtsp://admin:password@192.168.1.100:554/stream1" \
  --exit-camera "rtsp://admin:password@192.168.1.101:554/stream1"
```

#### Command Line Options
```
--zone ZONE_ID              Zone ID (default: 1)
--entry-camera SOURCE       Entry camera source (default: 0)
--exit-camera SOURCE        Exit camera source (optional)
--backend URL               Backend API URL (default: http://localhost:3000/api)
--no-deepface              Disable DeepFace (use face_recognition only)
```

### Step 3: View Live Feed

Once the system is running, you'll see:
- **Entry Camera**: Left side (or full screen if no exit camera)
- **Exit Camera**: Right side (if configured)
- **Face Boxes**: Green for recognized, Red for unknown
- **Labels**: Name and confidence percentage
- **Timestamp**: Current date and time

**Keyboard Controls:**
- `q` - Quit application
- `e` - Show Entry camera only
- `x` - Show Exit camera only
- `b` - Show Both cameras (side by side)

---

## How It Works

### Entry Detection Flow
```
1. Entry camera detects face
2. Face recognized → Match found in database
3. System checks if person already in zone (ActivePresence)
4. If not present:
   ├─ Create entry in ActivePresence (Zone_id, Student_ID/Teacher_ID, EntryTime)
   ├─ Create entry in AttendanceLog (EntryTime, ExitTime=NULL)
   └─ Send notification to backend API
5. Display confirmation on screen
```

### Exit Detection Flow
```
1. Exit camera detects face
2. Face recognized → Match found in database
3. System checks if person is in zone (ActivePresence)
4. If present:
   ├─ Calculate duration (ExitTime - EntryTime)
   ├─ Update AttendanceLog (set ExitTime and Duration)
   ├─ Delete from ActivePresence
   └─ Send notification to backend API
5. Display exit confirmation on screen
```

### Database Schema

#### ActivePresence Table
```sql
CREATE TABLE "ActivePresence" (
    "Presence_ID" SERIAL PRIMARY KEY,
    "Zone_id" INTEGER NOT NULL,
    "Student_ID" INTEGER,
    "Teacher_ID" INTEGER,
    "PersonType" VARCHAR(50) NOT NULL,
    "EntryTime" TIMESTAMP DEFAULT NOW()
);
```

#### AttendanceLog Table
```sql
CREATE TABLE "AttendanceLog" (
    "Log_ID" SERIAL PRIMARY KEY,
    "Zone_id" INTEGER NOT NULL,
    "Student_ID" INTEGER,
    "Teacher_ID" INTEGER,
    "PersonType" VARCHAR(50) NOT NULL,
    "EntryTime" TIMESTAMP NOT NULL,
    "ExitTime" TIMESTAMP,
    "Duration" INTEGER,  -- in minutes
    "CreatedAt" TIMESTAMP DEFAULT NOW()
);
```

**Note**: AttendanceLog is for **STUDENTS ONLY** as per attendance requirements.

---

## Testing

### 1. Check Database Tables
```sql
-- View active presence
SELECT * FROM "ActivePresence" WHERE "Zone_id" = 1;

-- View attendance logs (students only)
SELECT 
    al.*,
    s."Name",
    s."RollNumber"
FROM "AttendanceLog" al
LEFT JOIN "Students" s ON al."Student_ID" = s."Student_ID"
WHERE al."Zone_id" = 1 
  AND al."PersonType" = 'Student'
ORDER BY al."EntryTime" DESC;

-- View unknown faces
SELECT * FROM "UnknownFaces" WHERE "Zone_id" = 1 ORDER BY "DetectedTime" DESC;
```

### 2. Test Face Recognition
```bash
# Run detection with debug logging
python camera_detection_system.py --zone 1 --entry-camera 0
```

### 3. Verify Backend API
```bash
# Check if backend receives notifications
curl http://localhost:3000/api/zones/1/current
curl http://localhost:3000/api/zones/1/timetable-logs?limit=10
```

---

## Troubleshooting

### Issue: "No face detected in image"
**Solution**: Ensure face images are:
- Clear and well-lit
- Face is looking at camera
- Resolution at least 640x480
- Only one face per image

### Issue: "Database connection failed"
**Solution**:
1. Check PostgreSQL is running
2. Verify credentials in `.env` file
3. Test connection: `psql -U postgres -d FYP_Intellisight`

### Issue: "Camera not found"
**Solution**:
1. Check camera is connected
2. Test camera: `python -c "import cv2; print(cv2.VideoCapture(0).isOpened())"`
3. Try different camera index (0, 1, 2...)

### Issue: "Low FPS / Slow detection"
**Solution**:
1. Increase `PROCESS_EVERY_N_FRAMES` in .env
2. Use `hog` instead of `cnn` for detection method
3. Reduce `CAMERA_WIDTH` and `CAMERA_HEIGHT`
4. Close other camera applications

### Issue: "Face recognition not accurate"
**Solution**:
1. Retrain with more face images (3-5 per person)
2. Adjust `RECOGNITION_TOLERANCE` (lower = stricter)
3. Ensure good lighting during detection
4. Use DeepFace for better accuracy

### Issue: "Duplicate entries in database"
**Solution**: The system automatically checks for duplicates. If still occurring:
1. Check cooldown period (`detection_cooldown` in code)
2. Verify ActivePresence checks are working
3. Check database constraints

---

## Performance Optimization

### For Better FPS
1. **Use HOG detection**: Faster than CNN
2. **Process fewer frames**: Increase `PROCESS_EVERY_N_FRAMES`
3. **Reduce resolution**: Lower camera resolution
4. **Disable DeepFace**: Use `--no-deepface` flag

### For Better Accuracy
1. **Use CNN detection**: More accurate but slower
2. **Use DeepFace**: Advanced recognition models
3. **Lower tolerance**: Stricter matching (0.4-0.5)
4. **More training images**: 3-5 images per person

---

## Advanced Configuration

### Using IP Cameras (RTSP)
```bash
# Entry camera: IP Camera 1
# Exit camera: IP Camera 2
python camera_detection_system.py \
  --zone 1 \
  --entry-camera "rtsp://username:password@192.168.1.100:554/stream1" \
  --exit-camera "rtsp://username:password@192.168.1.101:554/stream1"
```

### Multi-Zone Setup
```bash
# Zone 1 - Library (Terminal 1)
python camera_detection_system.py --zone 1 --entry-camera 0 --exit-camera 1

# Zone 2 - Lab (Terminal 2)
python camera_detection_system.py --zone 2 --entry-camera 2 --exit-camera 3

# Zone 3 - Classroom (Terminal 3)
python camera_detection_system.py --zone 3 --entry-camera 4 --exit-camera 5
```

### Using with Backend API
The system automatically sends notifications to the backend API:
- `POST /api/zones/{zone_id}/recognize` - Entry/Exit notification
- System works offline and queues updates if backend is unavailable

---

## Maintenance

### Daily Tasks
- Monitor system logs
- Check database size
- Verify camera feeds

### Weekly Tasks
- Clean up old unknown faces
- Review attendance logs
- Check for database errors

### Monthly Tasks
- Retrain face encodings with new images
- Update system dependencies
- Backup database

---

## Support

For issues or questions:
1. Check logs: `logs/system.log`
2. Review database: Check ActivePresence and AttendanceLog tables
3. Test cameras: Verify camera sources work independently
4. Check documentation: README.md files in face-recognition folder

---

## API Integration

### Example API Calls

#### Get Active Persons in Zone
```javascript
fetch('http://localhost:3000/api/zones/1/current')
  .then(res => res.json())
  .then(data => console.log('Active persons:', data));
```

#### Get Attendance Logs
```javascript
fetch('http://localhost:3000/api/zones/1/timetable-logs?limit=20')
  .then(res => res.json())
  .then(data => console.log('Attendance logs:', data));
```

#### Get Unknown Faces
```javascript
fetch('http://localhost:3000/api/zones/1/unknown-list?limit=20')
  .then(res => res.json())
  .then(data => console.log('Unknown faces:', data));
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Camera Detection System                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐              ┌──────────────┐        │
│  │ Entry Camera │              │ Exit Camera  │        │
│  └──────┬───────┘              └──────┬───────┘        │
│         │                              │                │
│         ├──────────────┬───────────────┤                │
│         │              │               │                │
│         ▼              ▼               ▼                │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │Face Detect │ │Face Recog  │ │ Tracking   │         │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘         │
│        │              │               │                 │
│        └──────────────┴───────────────┘                 │
│                       │                                 │
│                       ▼                                 │
│              ┌────────────────┐                         │
│              │   Database     │                         │
│              │ - ActivePresence                         │
│              │ - AttendanceLog                          │
│              │ - UnknownFaces                           │
│              └────────┬───────┘                         │
│                       │                                 │
│                       ▼                                 │
│              ┌────────────────┐                         │
│              │  Backend API   │                         │
│              │  (Node.js)     │                         │
│              └────────────────┘                         │
│                       │                                 │
│                       ▼                                 │
│              ┌────────────────┐                         │
│              │  Dashboard UI  │                         │
│              │  (React)       │                         │
│              └────────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

---

## License
IntelliSight FYP Project - 2025
