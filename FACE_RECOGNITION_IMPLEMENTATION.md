# Face Recognition System - Complete Implementation

## Overview
Dual-camera face recognition system with entry/exit tracking for IntelliSight FYP project.

## Database Schema Changes

### New Tables Added
1. **ActivePresence** - Tracks currently present persons in zones
2. **AttendanceLog** - Permanent log of entry/exit with timestamps and duration

### Modified Tables
- **Camara**: Added `Camera_Type` (Entry/Exit) and `Camera_URL` fields
- **Students**: Added `Face_Embeddings` BYTEA field
- **Teacher**: Added `Face_Embeddings` BYTEA field

## Python Face Recognition Service

### Location
`/face-recognition/` directory

### Files Created
- `config.py` - Configuration management
- `database_handler.py` - PostgreSQL database operations
- `enrollment.py` - Face embedding generation and storage
- `recognition.py` - Dual-camera real-time recognition
- `.env` - Environment variables
- `requirements.txt` - Python dependencies

### Installation
```bash
cd face-recognition
pip install -r requirements.txt
```

### Usage

**Enroll Single Person:**
```bash
python enrollment.py --type student --id 1
python enrollment.py --type teacher --id 2
```

**Enroll All:**
```bash
python enrollment.py --all
```

**Start Recognition:**
```bash
python recognition.py --zone 1
```

## Backend API Endpoints

### Face Recognition Routes
- `POST /api/face-recognition/enroll` - Enroll single person
- `POST /api/face-recognition/enroll-all` - Batch enrollment
- `GET /api/face-recognition/active-presence` - Get all active presence
- `GET /api/face-recognition/active-presence/:zoneId` - Get zone active presence
- `GET /api/face-recognition/attendance-log` - Query attendance logs with filters
- `POST /api/face-recognition/start/:zoneId` - Start recognition for zone

### Files Modified/Created
- `src/controllers/faceRecognition.controller.js`
- `src/routes/faceRecognition.routes.js`
- `src/routes/index.js`

## Frontend Dashboard

### New Pages
1. **Active Presence** (`/active-presence`) - Real-time zone occupancy
2. **Attendance Logs** (`/attendance-logs`) - Historical entry/exit data with CSV export

### Modified Pages
- **Students**: Added "Enroll" button with loading indicator
- **Teachers**: Added "Enroll" button with loading indicator

### Files Created/Modified
- `admin-dashboard/src/pages/ActivePresence.jsx`
- `admin-dashboard/src/pages/AttendanceLogs.jsx`
- `admin-dashboard/src/api/faceRecognition.js`
- `admin-dashboard/src/App.jsx`
- `admin-dashboard/src/components/Sidebar.jsx`
- `admin-dashboard/src/pages/Students.jsx`
- `admin-dashboard/src/pages/Teachers.jsx`

## System Flow

### 1. Enrollment Phase
1. Admin adds student/teacher with 5 face pictures via dashboard
2. Click "Enroll" button on Students/Teachers page
3. Backend spawns Python script to process images
4. Face embeddings generated and stored in `Face_Embeddings` field
5. Cache created in `known_faces_cache.pkl`

### 2. Recognition Phase
1. Configure zone with 2 cameras (Entry/Exit type)
2. Start recognition via API or Python script
3. **Entry Camera**: Detects face → Matches → Adds to ActivePresence
4. **Exit Camera**: Detects face → Matches → Removes from ActivePresence → Creates AttendanceLog

### 3. Data Flow
```
Entry Detection → ActivePresence (temporary)
Exit Detection → Remove from ActivePresence + Create AttendanceLog (permanent)
```

## Configuration

### Camera Setup
Update cameras in database with:
- `Camera_Type`: "Entry" or "Exit"
- `Camera_URL`: Device index (e.g., "0") or RTSP URL

### Face Recognition Parameters
Edit `face-recognition/.env`:
- `RECOGNITION_TOLERANCE`: 0.6 (lower = stricter)
- `CONSECUTIVE_MATCHES`: 3 frames required
- `FRAME_SKIP`: Process every Nth frame
- `MIN_FACE_SIZE`: 80 pixels minimum

## Features

### Active Presence Dashboard
- Real-time zone occupancy
- Auto-refresh every 10 seconds
- Filter by zone
- Shows entry time and duration
- Color-coded (Blue=Student, Green=Teacher)

### Attendance Logs
- Permanent entry/exit history
- Filters: Zone, Person Type, Date Range
- Pagination support
- CSV export functionality
- Duration calculation in minutes/hours

### Face Enrollment
- Processes 5 face pictures per person
- Generates 128D encodings using face_recognition library
- Stores serialized embeddings in database
- Cache for fast loading
- Visual loading indicators in UI

## Testing Checklist

1. ✓ Database schema migrated
2. ✓ Python dependencies installed
3. ✓ Backend API endpoints created
4. ✓ Frontend pages and navigation added
5. ⏳ Enroll test student with 5 pictures
6. ⏳ Enroll test teacher with 5 pictures
7. ⏳ Configure zone with entry/exit cameras
8. ⏳ Run recognition script
9. ⏳ Verify entry detection adds to ActivePresence
10. ⏳ Verify exit detection logs to AttendanceLog
11. ⏳ Check timestamps and duration calculation

## Next Steps

1. Update camera records in database with Camera_Type and Camera_URL
2. Test enrollment with existing students/teachers
3. Run recognition script for a zone
4. Verify data flow through ActivePresence and AttendanceLog tables
5. Test frontend dashboards (Active Presence, Attendance Logs)

## Dependencies

### Python
- face-recognition==1.3.0
- opencv-python==4.8.1.78
- psycopg2-binary==2.9.9
- python-dotenv==1.0.0

### Node.js (Already installed)
- @prisma/client
- express
- react-router-dom

## Notes

- ActivePresence is temporary (cleared on exit)
- AttendanceLog is permanent
- Each person can only have one ActivePresence record per zone
- Duration calculated automatically on exit
- Unknown faces saved to UnknownFaces table
- Face embeddings cached for performance
