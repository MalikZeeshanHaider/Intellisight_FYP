# 📹 IntelliSight - RTSP Camera Integration & Face Recognition Guide

## 🎯 Complete System Setup

### Prerequisites Checklist
- ✅ Backend server (Node.js) running on port 3000
- ✅ Frontend (React/Vite) running on port 3001
- ✅ PostgreSQL database on port 5000
- ✅ Python 3.8+ installed
- ✅ RTSP camera(s) with network access
- ✅ Face images for training enrolled in database

---

## 📋 Step-by-Step Setup Guide

### Step 1: Install Python Face Recognition Dependencies

```bash
cd Facerecongination

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

**Important**: This may take 10-15 minutes as it downloads TensorFlow, OpenCV, and DeepFace models.

---

### Step 2: Test RTSP Camera Connectivity

Before using cameras in the system, **always test them first**:

```bash
# Test single camera
python test_rtsp_camera.py --url "rtsp://admin:password@192.168.1.100:554/stream" --duration 10

# Test multiple cameras from file
python test_rtsp_camera.py --file camera_urls.txt
```

**Example camera_urls.txt:**
```
rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0
rtsp://admin:password@192.168.1.101:554/cam/realmonitor?channel=1&subtype=0
rtsp://admin:password@192.168.1.102/cam/realmonitor?channel=1&subtype=0
```

**Expected Output:**
```
======================================================================
RTSP CAMERA CONNECTION TEST
======================================================================
[1/4] Initializing connection to camera...
✓ Connection established

[2/4] Reading camera properties...
✓ Resolution: 1920x1080
✓ FPS: 25

[3/4] Testing frame capture...
✓ Captured 250 frames in 10.0 seconds
✓ Actual FPS: 25.0
✓ Failed reads: 0

[4/4] Connection Test Result:
✅ SUCCESS: Camera is working properly!
```

**Common Issues:**
- ❌ **Connection failed**: Check IP address, username, password
- ❌ **Timeout**: Verify network connectivity, firewall rules
- ❌ **Authentication failed**: Check camera credentials
- ❌ **Port blocked**: Ensure RTSP port (usually 554) is open

---

### Step 3: Train Face Recognition System

You need face embeddings before recognizing people:

```bash
# Enroll faces from database images
python enrollment.py --train

# Or use the standalone training script
python train.py
```

**This will:**
1. Load all student/teacher images from database
2. Generate FaceNet embeddings (128D vectors)
3. Save to `embeddings/representations_facenet.json`

**Expected Output:**
```
[ENROLLMENT] Starting face enrollment...
[DATABASE] Loaded 8 students and 5 teachers
[PROCESSING] Processing Student: Alice...
✓ Generated 3 embeddings
[PROCESSING] Processing Teacher: Dr. Smith...
✓ Generated 5 embeddings
[TRAINING] Saved 47 embeddings to embeddings/representations_facenet.json
✅ Enrollment completed successfully!
```

---

### Step 4: Start Camera Streaming Service

This Python service processes RTSP streams and performs face recognition:

```bash
# Start the streaming service
python camera_streaming_service.py
```

**Expected Output:**
```
======================================================================
IntelliSight - Live Camera Streaming Service
======================================================================
Loaded 47 face embeddings
Database connected
======================================================================
Service ready!
======================================================================
 * Running on http://0.0.0.0:5001
```

**The service provides:**
- **Port 5001**: Camera streaming and API endpoints
- **Face Recognition**: Real-time detection using DeepFace FaceNet
- **Database Integration**: Auto-logs entries/exits to ActivePresence and AttendanceLog

---

### Step 5: Configure Cameras in Frontend

1. **Login to Admin Dashboard**: `http://localhost:3001/login`
2. **Navigate to Zones**: Click "Zones" in sidebar
3. **Select Zone**: Click "View Live" on desired zone
4. **Add Camera**:
   - Click "Add Camera" button
   - Select Camera Type (Entry/Exit/Both)
   - Enter RTSP URL (complete URL with credentials)
   - (Optional) Enter password
   - Click "Add Camera"

**Example RTSP URLs:**
```
With port:    rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1
Without port: rtsp://admin:password@192.168.10.4/cam/realmonitor?channel=1&subtype=0
```

---

### Step 6: Start Live Recognition

Once cameras are configured, they automatically connect to the streaming service:

**Automatic Process:**
1. Frontend loads cameras from database
2. Each camera displays live feed from: `http://localhost:5001/stream/{camera_id}`
3. Python service:
   - Connects to RTSP URL
   - Detects faces using Haar Cascade
   - Recognizes faces using DeepFace FaceNet
   - Draws bounding boxes with names
   - Logs entries/exits to database

**Visual Indicators:**
- **Green box + name**: Known person recognized
- **Red box + "Unknown"**: Face detected but not in database
- **Yellow box + "Detecting..."**: Processing face
- **FPS counter**: Shows streaming performance
- **Camera Offline**: Connection failed or camera unreachable

---

## 🔧 API Endpoints Reference

### Camera Streaming Service (Port 5001)

#### Health Check
```bash
GET http://localhost:5001/health
```
Response:
```json
{
  "status": "ok",
  "active_cameras": 2,
  "known_persons": 47
}
```

#### Start Camera
```bash
POST http://localhost:5001/cameras/start
Content-Type: application/json

{
  "camera_id": 1,
  "camera_url": "rtsp://admin:password@192.168.1.100/stream",
  "camera_type": "Entry",
  "zone_id": 5
}
```

#### Stop Camera
```bash
POST http://localhost:5001/cameras/stop/1
```

#### List Active Cameras
```bash
GET http://localhost:5001/cameras/list
```

#### Stream Video Feed
```bash
GET http://localhost:5001/stream/1
```
Returns: MJPEG stream with face detection overlays

#### Start All Zone Cameras
```bash
POST http://localhost:5001/zones/5/start_all
```

---

## 🧪 Testing Checklist

### 1. Test RTSP Connection
```bash
python test_rtsp_camera.py --url "YOUR_RTSP_URL"
```
✅ Camera connects and displays video

### 2. Test Face Recognition on Webcam
```bash
python recognize.py
```
✅ Detects and recognizes faces from webcam

### 3. Test Database Integration
```bash
python recognition_live.py --zone 1
```
✅ Logs entries/exits to database

### 4. Test Streaming Service
```bash
# Terminal 1: Start service
python camera_streaming_service.py

# Terminal 2: Test API
curl http://localhost:5001/health
```
✅ Service responds with status

### 5. Test Frontend Integration
1. Open `http://localhost:3001/zones/1/live`
2. Add camera with RTSP URL
3. Check if live video appears
✅ Video stream displays with face detection

### 6. End-to-End Test
1. Person walks in front of Entry camera
2. Check `ActivePresence` table for entry
3. Person walks past Exit camera
4. Check `AttendanceLog` for logged visit
✅ Database correctly tracks presence

---

## 📊 System Architecture

```
┌─────────────────────┐
│  RTSP Camera        │ rtsp://...
│  (IP Camera)        │
└──────────┬──────────┘
           │ RTSP Stream
           ▼
┌─────────────────────────────────────┐
│  Camera Streaming Service (5001)    │
│  - OpenCV: RTSP capture             │
│  - DeepFace: Face recognition       │
│  - Flask: HTTP streaming            │
│  - PostgreSQL: Logging              │
└──────────┬──────────────────────────┘
           │ MJPEG Stream
           ▼
┌─────────────────────────────────────┐
│  Frontend (3001)                     │
│  - React: Display video             │
│  - Camera management UI             │
└──────────┬──────────────────────────┘
           │ REST API
           ▼
┌─────────────────────────────────────┐
│  Backend API (3000)                  │
│  - Node.js + Express                │
│  - Prisma ORM                       │
└──────────┬──────────────────────────┘
           │ SQL
           ▼
┌─────────────────────────────────────┐
│  PostgreSQL Database (5000)         │
│  - Zones, Cameras                   │
│  - Students, Teachers               │
│  - ActivePresence, AttendanceLog    │
└─────────────────────────────────────┘
```

---

## 🎯 Camera Types & Behavior

### Entry Camera
- **Purpose**: Detect people entering a zone
- **Action**: Adds person to `ActivePresence` table
- **Indicator**: Green badge in UI
- **Database**: 
  ```sql
  INSERT INTO "ActivePresence" (Student_ID, Zone_id, EntryTime)
  VALUES (1, 5, NOW())
  ```

### Exit Camera
- **Purpose**: Detect people leaving a zone
- **Action**: 
  1. Removes from `ActivePresence`
  2. Logs to `AttendanceLog` with duration
- **Indicator**: Red badge in UI
- **Database**:
  ```sql
  DELETE FROM "ActivePresence" WHERE Student_ID = 1;
  INSERT INTO "AttendanceLog" (Student_ID, EntryTime, ExitTime, Duration)
  VALUES (1, '2025-12-13 10:00:00', '2025-12-13 11:30:00', 5400);
  ```

### Both Camera
- **Purpose**: Single camera for both entry and exit
- **Action**: Toggles presence (smart detection)
- **Indicator**: Blue badge in UI

---

## ⚙️ Configuration Options

### Face Recognition Settings (config.py)

```python
# Model settings
MODEL_NAME = "Facenet"              # FaceNet (128D embeddings)
DETECTOR_BACKEND = "retinaface"     # Face detector
DISTANCE_THRESHOLD = 10.0           # Recognition threshold
MIN_FACE_SIZE = 30                  # Minimum face size (pixels)
CONSECUTIVE_MATCHES = 3             # Matches needed for confirmation

# Performance settings
FRAME_SKIP = 2                      # Process every N frames
PROCESS_EVERY_N_FRAMES = 10         # Recognition frequency
MAX_FACES = 10                      # Max faces per frame
```

**Tuning Guide:**
- **Lower DISTANCE_THRESHOLD**: Stricter matching (fewer false positives)
- **Higher DISTANCE_THRESHOLD**: Looser matching (more false positives)
- **Higher FRAME_SKIP**: Better performance, lower accuracy
- **Lower MIN_FACE_SIZE**: Detect smaller/distant faces

---

## 🐛 Troubleshooting

### Camera Not Connecting
```
Error: Failed to connect to camera
```
**Solutions:**
1. Test RTSP URL with VLC Media Player first
2. Check network connectivity: `ping 192.168.1.100`
3. Verify RTSP port is open: `telnet 192.168.1.100 554`
4. Check firewall rules
5. Ensure camera RTSP is enabled in camera settings

### Face Recognition Not Working
```
No faces detected / All faces show as "Unknown"
```
**Solutions:**
1. Train embeddings: `python enrollment.py --train`
2. Check embeddings file exists: `embeddings/representations_facenet.json`
3. Verify images are properly enrolled in database
4. Adjust `DISTANCE_THRESHOLD` in config.py
5. Check lighting conditions (face recognition needs good lighting)

### Low FPS / Performance Issues
```
FPS: 5-10 (should be 20-30)
```
**Solutions:**
1. Increase `PROCESS_EVERY_N_FRAMES` (process less frequently)
2. Decrease camera resolution in camera settings
3. Use faster detector: Change `DETECTOR_BACKEND` to "opencv"
4. Close other applications using CPU/GPU
5. Consider using GPU acceleration (TensorFlow-GPU)

### Database Logging Not Working
```
Entries/exits not appearing in database
```
**Solutions:**
1. Check database connection: `psql -U postgres -h localhost -p 5000 -d FYP_Intellisight`
2. Verify person names match database exactly
3. Check database handler logs in terminal
4. Ensure Zone_id and Camera_id are correct
5. Check `ActivePresence` and `AttendanceLog` tables directly

### Streaming Service Crashes
```
Service stops responding or crashes
```
**Solutions:**
1. Check Python version: `python --version` (should be 3.8+)
2. Reinstall dependencies: `pip install -r requirements.txt --upgrade`
3. Check available memory: Close other applications
4. Review error logs in terminal
5. Restart with debug mode: Set `debug=True` in app.run()

---

## 📈 Performance Benchmarks

### Typical Performance (Intel i5, 8GB RAM)
- **FPS**: 20-25 FPS per camera
- **Face Detection**: 30-50ms per frame
- **Face Recognition**: 100-200ms per face
- **Simultaneous Cameras**: 2-4 cameras smoothly
- **Network Bandwidth**: 2-5 Mbps per camera

### Optimization Tips
1. **Use Entry/Exit pairs**: Not "Both" type cameras
2. **Lower resolution**: 720p instead of 1080p
3. **Reduce FPS**: 15 FPS is usually sufficient
4. **Process fewer frames**: Increase PROCESS_EVERY_N_FRAMES
5. **Use faster detector**: "opencv" instead of "retinaface"

---

## 🚀 Production Deployment Checklist

- [ ] All cameras tested with `test_rtsp_camera.py`
- [ ] Face embeddings trained and verified
- [ ] Streaming service runs as system service
- [ ] Database backups configured
- [ ] Firewall rules configured (ports 3000, 3001, 5000, 5001)
- [ ] SSL/HTTPS certificates installed
- [ ] Error logging and monitoring setup
- [ ] Performance monitoring configured
- [ ] User authentication tested
- [ ] Camera failover/reconnection tested

---

## 📝 Quick Command Reference

```bash
# Test camera
python test_rtsp_camera.py --url "rtsp://..."

# Train face recognition
python enrollment.py --train

# Start streaming service
python camera_streaming_service.py

# Test webcam recognition
python recognize.py

# Run full system with zone cameras
python recognition_live.py --zone 1

# Check service health
curl http://localhost:5001/health

# View database entries
psql -U postgres -p 5000 -d FYP_Intellisight -c 'SELECT * FROM "ActivePresence";'
```

---

## 🎉 Success Indicators

Your system is working correctly when:
- ✅ Cameras show live video in frontend
- ✅ Green boxes appear around known faces with names
- ✅ FPS counter shows 20+ FPS
- ✅ `ActivePresence` table updates when person enters
- ✅ `AttendanceLog` records complete visits with duration
- ✅ System can handle multiple cameras simultaneously
- ✅ Faces are recognized within 0.5-1 second
- ✅ Camera reconnects automatically after network interruption

---

## 📞 Support & Documentation

- **Backend API**: `http://localhost:3000/api/health`
- **Streaming API**: `http://localhost:5001/health`
- **Frontend**: `http://localhost:3001`
- **Database**: `localhost:5000/FYP_Intellisight`

**Logs Location:**
- Backend: Terminal running `npm run dev`
- Streaming Service: Terminal running `camera_streaming_service.py`
- Database: PostgreSQL logs
- Frontend: Browser console (F12)

---

**Last Updated**: December 13, 2025
**Version**: 2.0 - Full RTSP Integration with Face Recognition
